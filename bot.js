/* eslint-env node */

const basicYTUrl = 'https://www.youtube.com/watch?v='
console.log('beep beep! ')

require('dotenv').config()
const fs = require('fs')
const Discord = require('discord.js')
const ytdl = require('ytdl-core')
const search = require('youtube-search');
const axios = require('axios');
const SpotifyWebApi = require('spotify-web-api-node');
const translate = require('translation-google');

const bot = new Discord.Client()
const prefix = '!oz'
const queue = new Map()

var spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: 'http://www.example.com/callback'
  });

bot.login(process.env.TOKEN)
bot.on('ready', readyDiscord)
bot.on('message', gotMessage)

bot.on('voiceStateUpdate', (oldMember, newMember) => {
    let oldVoice = oldMember.channelID; 
    let newVoice = newMember.channelID; 

    if (oldVoice !== newVoice) {
        if (oldVoice == null) {
            if(newMember.id === bot.user.id) {
                console.log("Ozjasz bot joined!");
                let serverQueue = queue.get(newMember.guild.id)
                if(serverQueue && serverQueue.songs!==[] && serverQueue.connection != null){
                    console.log(serverQueue.songs[0])
                    console.log(serverQueue.connection)
                    connectBot(newMember.guild.id, newMember.channel, serverQueue).then(conn => {
                        if(conn)
                            play(newMember.guild, serverQueue.songs[0])
                    })
                }   
            }
            else
                console.log("User joined!");
        } else if (newVoice == null) {
            if(oldMember.id === bot.user.id) {
                console.log("Ozjasz bot left!");
            }
            else
                console.log("User left!");
        } else {
            console.log("User switched channels!");
        }
    }
})

const opts = {
    maxResults: 5,
    key: process.env.YOUTUBE_KEY
  };
  
function readyDiscord() {
    console.log('its ready already!')
    bot.user.setActivity('!oz help', { type: 'PLAYING' })

    spotifyApi.setAccessToken(process.env.SPOTIFY_ACCESS_TOKEN);
    newToken();
    setInterval(() => newToken(), 1000 * 60 * 60);
}

function newToken(){
    spotifyApi.clientCredentialsGrant().then(
        function(data) {
            spotifyApi.setAccessToken(data.body['access_token']);
        },
        function(err) {
            console.log(err)
        }
    );
}

async function gotMessage(message) {
    console.log(message.content)
    const serverQueue = queue.get(message.guild.id)

    const messageSplit = message.content.split(' ')
    if(messageSplit[0] === prefix) {
        let messageNoPrefix = message.content.split('!oz ').join('');
        
        if(messageSplit.length<=1) {
            getRandomLine("ozjasz-wypowiedzi.txt").then(sentence => {
                message.channel.send(sentence)
            })
        }
        else {
            switch(messageSplit[1]){
                case `play`:
                    playCommand(message, messageSplit, messageNoPrefix, serverQueue)
                    break;
                case `playlist`:
                    if(messageSplit.length==3 && messageSplit[2].startsWith('https://www.youtube.com/'))
                        youtubePlaylist(message, messageSplit[2])
                    else if(messageSplit.length==3 && messageSplit[2].startsWith('https://open.spotify.com/playlist/')) 
                        spotifyPlayList(message, messageSplit[2])
                    break;
                case `skip`:
                    skipCommand(message, serverQueue)
                    break;
                case `skipto`:
                    skipToCommand(message, messageSplit, serverQueue)
                    break;
                case 'pause': 
                    if(checkPermissions && serverQueue.connection != null){
                        console.log('pause')
                        serverQueue.connection.dispatcher.pause()
                    }
                    break;
                case 'resume': 
                    if(checkPermissions && serverQueue.connection != null) {
                        console.log('resume')
                        serverQueue.connection.dispatcher.resume()
                    }
                    break;
                case `clear`:
                    clearCommand(message, serverQueue)
                    break;
                case `queue`:
                    getQueueCommand(message, serverQueue)
                    break;
                case 'delete': 
                    deleteSongCommand(messageSplit, serverQueue)
                    break;
                case `help`:
                    commandList(message)
                    break;
                case 'boczek':
                    getRandomLine("boczek-epitety.txt").then(sentence => {
                        message.channel.send(messageNoPrefix.split('boczek ').join('')+ ' to '+ sentence)
                    })
                    break;  
                case 'instrukcja':
                    getRandomLine("instrukcja-lol.txt").then(sentence => {
                        message.channel.send(sentence)
                    })
                    break;    
                case 'random': 
                    if(messageSplit.length===3){
                        let voiceChannel = getUserVoiceChannel(message, getUserId(messageSplit[2]))
                        playAtTop(message, voiceChannel, getRandomOzjasz(), serverQueue)
                    }
                    else
                        playAtTop(message, message.member.voice.channel, getRandomOzjasz(), serverQueue)
                    break;
                case 'join': 
                    // message.member.voice.channel.join();
                    createQueue(message, message.member.voice.channel, null);
                    break;
                case 'spotify': 
                    spotifyPlayList(message)
                break;
                case 'guess': 
                    console.log('halo1')
                    predictSentiment(message, messageNoPrefix.split('guess').join(''))
                break;
                default:
                    commandList(message);
            }
        }
    }
}
async function predictSentiment(message, sentence) {
    try {
        const englishSentence = await translate(sentence, {from: 'pl', to: 'en'});
        console.log(englishSentence.text)

        // const results = await axios.post('http://127.0.0.1:5000/api/sentiment', { text: englishSentence.text })
        const results = await axios.post('https://sentiment-predictor.herokuapp.com/api/sentiment', { text: englishSentence.text })
        let response = results.data[0].predictions == 0? 'very bad' : 'very nice'
        response += ' - ' + roundToTwo(results.data[0].probability) +'%'

        message.channel.send(response)
    } catch(e){
        console.log(e)
    }
}

async function spotifyPlayList(message, url){
    const playlist_id = url.split('playlist/')[1]
    const results = await spotifyApi.getPlaylist(playlist_id)
    const resultsLength = Math.min(5, results.body.tracks.items.length)

    for(let i=0;i<resultsLength; i++)
    {
        const serverQueue = queue.get(message.guild.id)
        const title = results.body.tracks.items[i].track.name + ' - ' + results.body.tracks.items[i].track.artists[0].name
        const yt_result = await youtubeSearchUrl(title)

        if(i===0 && serverQueue == null)
            await addSong(message, yt_result.link, message.member.voice.channel, serverQueue)
        else if(!checkIfUrlInQueue(yt_result.link)) {
            const song = {
                title: title,
                url: yt_result.link,
                duration: secondsToTime(results.body.tracks.items[i].track.duration_ms/1000)
            }
            serverQueue.songs.push(song)
        }
    }
    message.channel.send(' Queued **' +resultsLength +'** tracks')
}

async function playCommand(message, messageSplit, messageNoPrefix, serverQueue) {
    if(messageSplit.length>=3) {
        if(messageSplit[2].startsWith('<@!')){
            let voiceChannel = getUserVoiceChannel(message, getUserId(messageSplit[2]))
            playCommandHelper(message, messageSplit, messageNoPrefix, serverQueue, 3, voiceChannel)
        }
        else {
            playCommandHelper(message, messageSplit, messageNoPrefix, serverQueue, 2, message.member.voice.channel)
        }
    }
}

async function playCommandHelper(message, messageSplit, messageNoPrefix, serverQueue, urlIndex, voiceChannel) {
    if(messageSplit[urlIndex].startsWith('http'))
        addSong(message, messageSplit[urlIndex], voiceChannel, serverQueue)
    else {
        if(urlIndex===3)
            messageNoPrefix = messageNoPrefix.replace(messageSplit[2],'')

        youtubeSearchUrl(messageNoPrefix.replace('play','')).then( results => {
            console.log('url: ' + results.link)
            addSong(message, results.link, voiceChannel, serverQueue)
        })
    }
}

function commandList(message) {
    const reply =  new Discord.MessageEmbed()
        .setAuthor('Ma Pan dowód, że Hitler wiedział o takiej komendzie? \n', bot.user.avatarURL())
        .addField('Music 🎵', '!oz play [tytuł lub url] \n  !oz play [@nick kogoś] [tytuł lub url] \n !oz playlist [url] \n !oz skip  \n !oz skipto [index] \n !oz pause \n !oz resume  \n !oz clear  \n !oz queue  \n !oz delete [index]', true)
        .setColor(0xa62019)
        .addField('Inne 🥓', '!oz  \n !oz boczek [coś] 🥓 \n !oz guess [coś] \n !oz instrukcja \n !oz random \n !oz random [@nick] \n !oz help \n', true)

    return message.channel.send(reply)
}

function deleteSongCommand(messageSplit, serverQueue){
    if(messageSplit.length===3){
        const index = parseInt(messageSplit[2], 10);
        if(serverQueue != null && index>=1 && index-1<serverQueue.songs.length){
            if(index-1 === 0)
                serverQueue.connection.dispatcher.end()
            else
                serverQueue.songs.splice(index-1, 1);
        }
    }
}

async function getQueueCommand(message, serverQueue) {
    // let queueEmbed = new Discord.MessageEmbed()
    // .setAuthor('A na drzewach zamiast liści.. 🌴 🌲 🌳  🎵 🎵 🎵 \n', client.user.avatarURL())
    // .setColor(0xa62019)

    if(serverQueue == null){
        const reply =  new Discord.MessageEmbed()
            .setAuthor('A na drzewach zamiast liści.. 🌴 🌲 🌳  🎵 🎵 🎵 \n', bot.user.avatarURL())
            .setDescription('... \n ...\n \n Pusty portfel, pusta kolejka..')
            .setColor(0xa62019)
        return message.channel.send(reply)
    }
    
    let songList = `\`\`\`nim\n`;
    songList+=`A na drzewach zamiast liści.. 🌴 🌲 🌳  🎵 🎵 🎵 \n\n`

    const length = Math.min(10, serverQueue.songs.length)
    let maxLength=0;
    for (let i = 0; i < length; i++) {
        if(maxLength<serverQueue.songs[i].title.length)
            maxLength = serverQueue.songs[i].title.length;
    }

    console.log('max length: '+maxLength)
    if(serverQueue !== null){
        for (let i = 0; i < length; i++) {
            if(i+1<10)
                songList+=` `
            let spaces =  createSpaces(maxLength - serverQueue.songs[i].title.length + 4)
            songList += `${(i + 1)}.\t${serverQueue.songs[i].title}${spaces}${serverQueue.songs[i].duration} \t\n`
        }
    }
    if(serverQueue.songs.length>10)
        songList+=`\n   \t+${serverQueue.songs.length-10} tracks in queue. 🎵 \n`
    songList+=`\`\`\``

    // queueEmbed.setDescription(songList)

    console.log(songList)
    return message.channel.send(songList)
}

async function addSong(message, url, voiceChannel, serverQueue) {
    checkPermissions(message, voiceChannel)

    const songInfo = await ytdl.getInfo(url)
    const song = {
        title: songInfo.videoDetails.title.slice(0, 50),
        url: songInfo.videoDetails.video_url,
        duration: secondsToTime(songInfo.videoDetails.lengthSeconds)
    }

    if (!serverQueue) {
        createQueue(message, voiceChannel, song);
    } 
    else if(!checkIfUrlInQueue(song.url, serverQueue)){
        serverQueue.songs.push(song)

        if(!bot.voice.connections.some(conn => conn.channel.id === voiceChannel.id)){
            console.log('hmm not connected')
            connectBot(message.guild.id, voiceChannel, serverQueue)
        }

        const reply =  new Discord.MessageEmbed()
            .setDescription(`[${song.title}](${song.url}) dodano do kolejki! \t`)
            .setColor(0xa62019)
    
        return message.channel.send(reply)
    }
}

async function createQueue(message, voiceChannel, song) {
    const queueContruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        volume: 5,
        playing: true,
    }

    queue.set(message.guild.id, queueContruct)
    queueContruct.songs.push(song)

    connectBot(message.guild.id, voiceChannel, queue.get(message.guild.id)).then (conn => {
        if(conn)
            playMp3(message.guild, 'ozjasz.mp3')
        // play(message.guild, queue.get(message.guild.id).songs[0])
    })
}

async function connectBot(guildId, voiceChannel, queue){
    try {
        const connection = await voiceChannel.join()
        connection.voice.setSelfDeaf(true);
        queue.connection = connection
    } catch (err) {
        console.log(err)
        queue.delete(guildId)
        return false
    }
    return true
}

async function skipCommand(message, serverQueue) {
    if (!message.member.voice.channel)
        return shortEmbedReply(message, `Musisz Pan na kanale być by móc pomijać!`)
    if (!serverQueue)
        return shortEmbedReply(message, `Nie ma co pomijać Panie!`)
    serverQueue.connection.dispatcher.end()
}

async function skipToCommand(message, messageSplit, serverQueue) {
    if (!message.member.voice.channel)
        return shortEmbedReply(message, `Musisz Pan na kanale być by móc tyle pomijać!`)
    if (!serverQueue)
        return shortEmbedReply(message, `Nie ma co pomijać Panie!`)

    if(messageSplit.length===3){
        const index = parseInt(messageSplit[2], 10);
        if(serverQueue !== null && index>=2 && index-1<serverQueue.songs.length){
            serverQueue.songs.splice(1,index-2)
            serverQueue.connection.dispatcher.end()
        }
    }
}

async function clearCommand(message, serverQueue) {
    if (!message.member.voice.channel)
        return shortEmbedReply(message, `Musisz Pan na kanale być by móc kolejke usuwać!`)

    if (serverQueue===null || serverQueue.connection===null || serverQueue.connection.dispatcher===null)
        return shortEmbedReply(message, `Nie ma co czyścić Panie!`)

    serverQueue.songs = []
    serverQueue.connection.dispatcher.end()
}

async function play(guild, song) {
    const serverQueue = queue.get(guild.id)
    if (!song) {
        serverQueue.voiceChannel.leave()
        queue.delete(guild.id)
        return
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url, {filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1<<25 }), {highWaterMark: 1})
        .on('finish', () => {
            serverQueue.songs.shift()
            play(guild, serverQueue.songs[0])
        })
        .on('error', (error) => console.error(error))
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)

    const reply =  new Discord.MessageEmbed()
        .setDescription(`Teraz gramy: [${song.title}](${song.url})! \t`)
        .setColor(0xa62019)
        
    serverQueue.textChannel.send(reply)
}

async function playMp3(guild, songPath) {
    const serverQueue = queue.get(guild.id)
    const dispatcher = serverQueue.connection.play(songPath)
    .on('finish', () => {
        if(serverQueue.songs[0]!=null)
            play(guild, serverQueue.songs[0])
    })
    .on('error', (error) => console.error(error))
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)
}

async function playAtTop(message, voiceChannel, url, serverQueue) { 
    checkPermissions(message, voiceChannel);

    const songInfo = await ytdl.getInfo(url)
    const song = {
        title: songInfo.videoDetails.title.slice(0, 50),
        url: songInfo.videoDetails.video_url,
        duration: secondsToTime(songInfo.videoDetails.lengthSeconds)
    }

    if (!serverQueue) {
        createQueue(message, voiceChannel, song);
    } else if(!checkIfUrlInQueue(song.url, serverQueue)) {
        play(message.guild, song)
        serverQueue.songs.unshift(song)
    }
}

async function getRandomLine(filename) {
    let data = await readFile(filename)
    data += ''
    const lines = data.split('\n')
    return lines[Math.floor(Math.random() * lines.length)]
}

function checkPermissions(message, voiceChannel) {
    if (!voiceChannel)
        return message.channel.send('You need to be in a voice channel to play music!')
    const permissions = voiceChannel.permissionsFor(message.client.user)
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('I need the permissions to join and speak in your voice channel!')
    }
}

async function readFile(path) {
    return new Promise((resolve, reject) => {
      fs.readFile(path, 'utf8', function (err, data) {
        if (err) {
          reject(err);
        }
        resolve(data);
      });
    });
}

function checkIfUrlInQueue(url, queue){
    if(queue != null){
        for(let i=0; i<queue.songs.length;i++) {
            if(queue.songs[i].url === url)
                return true;
        }
    }
    return false;
}

async function youtubeSearchUrl(text){
    return new Promise((resolve, reject) => {
        search(text, opts, function(err, results) {
        if(err) reject(err);

        let index = 0;
        for(let i=0; i<results.length;i++){
            if(results[i].kind === 'youtube#video'){
                index = i;
                break;
            }
        }
        resolve(results[index]);
        });
    })
}

async function youtubePlaylist(message, url){
    const startIndex = url.indexOf('list=')
    const endIndex = url.indexOf('&index')
    const playListId = url.substring(startIndex+5, endIndex==-1? url.length : endIndex)
    
    // part: 'id,snippet',
    console.log(playListId)
    const results = await axios.get(`https://www.googleapis.com/youtube/v3/playlistItems`, {
        params: {
            part: 'id,snippet',
            maxResults: 100,
            playlistId: playListId,
            key: process.env.YOUTUBE_KEY,
        }
    })
    
    let songList = []
    let songsCount=0;
    let videoIds = ''
    for(let i=0;i<results.data.items.length; i++)
    {
        if(!(results.data.items[i].snippet.title === 'Private video' && results.data.items[i].snippet.description === 'This video is private.')) {
            const songUrl = basicYTUrl + results.data.items[i].snippet.resourceId.videoId
            videoIds += results.data.items[i].snippet.resourceId.videoId + ','

            const song = {
                title: results.data.items[i].snippet.title.length>50? results.data.items[i].snippet.title.slice(0,50)+'...' : results.data.items[i].snippet.title,
                url: songUrl,
            }

            songList.push(song)
            songsCount++;
        }
    }
    videoIds = videoIds.slice(0, -1)

    const durationResults = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
        params: {
            part: 'contentDetails',
            id: videoIds,
            key: process.env.YOUTUBE_KEY
        }
    })
        
    for(let i=0;i<songList.length; i++)
    {
        const serverQueue = queue.get(message.guild.id)
        if(i===0 && serverQueue == null)
            await addSong(message, songList[i].url, message.member.voice.channel, serverQueue)
        else if(!checkIfUrlInQueue(songList[i].url)) {
            const song = {
                title: songList[i].title,
                url: songList[i].url,
                duration: convertIsoTime(durationResults.data.items[i].contentDetails.duration)
            }
            serverQueue.songs.push(song)
        }
    }
    message.channel.send(' Queued **' +songsCount +'** tracks') 
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function convertIsoTime(isoTime){
    let convertedTime = ''
    isoTime = isoTime.substring(2)

    const hourIndex = isoTime.indexOf('H')
    const minIndex = isoTime.indexOf('M')
    const secIndex = isoTime.indexOf('S')
    if(hourIndex!==-1)
        convertedTime+=isoTime.substring(0,hourIndex)

    if(minIndex!==-1){
        if(hourIndex!==-1)
            convertedTime+=':'
        convertedTime+=isoTime.substring(hourIndex+1,minIndex)+':'
    }

    if(secIndex!==-1){
        let secondText = isoTime.substring(minIndex+1, isoTime.length-1)
        let secondInt = parseInt(secondText, 10)
        if(secondInt<10)
            convertedTime+='0'
        convertedTime+=secondText
    }
    else
        convertedTime+='00'
    
        return convertedTime
}

function createSpaces(number){
    return Array(number).fill('\xa0').join('')
}

function secondsToTime(seconds){
    let timeStr = new Date(seconds * 1000).toISOString().substr(11, 8);

    if(seconds < 3600)
        timeStr=timeStr.substring(3, timeStr.length)

    if(seconds<600)
        timeStr=timeStr.substring(1, timeStr.length)
    return timeStr
}

function shortEmbedReply(message, reply){
    message.channel.send(new Discord.MessageEmbed().setDescription(reply).setColor(0xa62019))
}

function getRandomOzjasz(){
    const jaszczurUrl = 'https://www.youtube.com/watch?v=aZ5mQhDrnwc';
    const ozjaszEinReichUrl = 'https://www.youtube.com/watch?v=_FU--EfPmJ0'
    const jaszczur2Url = 'https://www.youtube.com/watch?v=V0hwtnJ5YAo'
    const jaszczur3Url = 'https://www.youtube.com/watch?v=brgjTUh8eZM&ab_channel=Nigdysi%C4%99niepoddawaj'
    const major = 'https://www.youtube.com/watch?v=2vQhOH_oBHE&ab_channel=Wkl%C4%99s%C5%82yMajorSuchodolski&fbclid=IwAR07n6SQrbsKlYsgRiZ0wnafsDjMvjlXV02psGwEP8gnbxpdmqE5RX0oXZY'
    const intermajor = 'https://www.youtube.com/watch?v=QP-N54BPz4Q'

    const urls = [jaszczurUrl, jaszczur2Url, jaszczur3Url, ozjaszEinReichUrl, major, intermajor]
    return urls[Math.floor(Math.random() * urls.length)];
}

function getUserId(userRef){
    return userRef.slice(3, userRef.length-1)
}

function getUserVoiceChannel(message, userId){
   return message.guild.member(userId).voice.channel
}

function roundToTwo(num) {    
    return +(Math.round(num + "e+2")  + "e-2");
}