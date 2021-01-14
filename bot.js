const rafonUrl = 'https://www.youtube.com/watch?v=CvgG4nYoyUc'
const rynekUrl = 'https://www.youtube.com/watch?v=a9bBEbAO8Ik'
const stonogaUrl = 'https://www.youtube.com/watch?v=3KtVI3hRjc0'

const basicYTUrl = 'https://www.youtube.com/watch?v='

console.log('beep beep! ')
require('dotenv').config()
const fs = require('fs')
const Discord = require('discord.js')
const ytdl = require('ytdl-core')
var search = require('youtube-search');
const { google } = require('googleapis');
const youtube = google.youtube('v3');
const axios = require('axios');
const { time } = require('console')

const myRnId = () => parseInt(Date.now() * Math.random());

const client = new Discord.Client()
const prefix = '!oz'
const queue = new Map()

client.login(process.env.TOKEN)

client.on('ready', readyDiscord)
client.on('message', gotMessage)



var opts = {
    maxResults: 5,
    key: process.env.YOUTUBE_KEY
  };

function readyDiscord() {
    console.log('its ready already!')
    client.user.setActivity('!oz help', { type: 'PLAYING' })

    console.log(secondsToTime(178))
}

async function gotMessage(message) {
    console.log(message.content)
    const serverQueue = queue.get(message.guild.id)

    const messageSplit = message.content.split(' ')
    if(messageSplit[0] === prefix) {
        var messageNoPrefix = message.content.split('!oz ').join('');
        
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
                    addPlaylist(message, messageSplit)
                    break;
                case `skip`:
                    skipCommand(message, serverQueue)
                    break;
                case `skipto`:
                    skipToCommand(message, messageSplit, serverQueue)
                    break;
                case `stop`:
                    stopCommand(message, serverQueue)
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
                        message.channel.send(messageNoPrefix.split('boczek ').join('')+ ' to ||'+ sentence+'||')
                    })
                    break;  
                case 'instrukcja':
                    getRandomLine("instrukcja-lol.txt").then(sentence => {
                        message.channel.send(sentence)
                    })
                    break;    
                default:
                    message.channel.send('Ma Pan dowód, że Hitler wiedział o takiej komendzie? ');
                    commandList(message);
            }
        }
    }
    else {
        // //easter egg - paróweczki
        // if (message.content.toLowerCase().includes('rynek')) {
        //     playAtTop(message, rynekUrl, serverQueue)
        // }
        // else if (message.content.toLowerCase().includes('rafon')) {
        //     playAtTop(message, rafonUrl, serverQueue)
        // }
        // else if (message.content.toLowerCase().includes('pis')) {
        //     playAtTop(message, stonogaUrl, serverQueue)
        // }
    }
}

function joinChannel() {
    const channel = client.channels.cache.get('692759541187739668')
    if (!channel) return console.error('The channel does not exist!')

    channel.join().then(() => {
            // Yay, it worked!
            console.log('Successfully connected.')
        })
        .catch((e) => {
            // Oh no, it errored! Let's log it to console :)
            console.error(e)
        })
}

function playCommand(message, messageSplit, messageNoPrefix, serverQueue) {
    if(messageSplit.length>=3) {
        if(messageSplit[2].startsWith('http'))
            addSong(message, messageSplit[2], serverQueue)
        else {
            youtubeSearchUrl(messageNoPrefix.replace('play','')).then( url => {
                console.log('url: ' + url)
                addSong(message, url, serverQueue)
            })
        }
    }
}

function commandList(message) {
    var reply =  new Discord.MessageEmbed()
        .setAuthor('Zgubiłeś się lewaku, zapomniałeś odpowiednich słów? .. \n', client.user.avatarURL())
        .addField('Music 🎵🎵🎵', '!oz play [tytuł lub url] \n !oz playlist [url] \n !oz skip  \n !oz skipto [index]  \n !oz stop  \n !oz queue  \n !oz delete [index]')
        .setColor(0xa62019)
        .addField('Inne 🥓🥓🥓', '!oz  \n !oz boczek <coś> 🥓 \n !oz instrukcja \n !oz help \n')

    return message.channel.send(reply)
}

function deleteSongCommand(messageSplit, serverQueue){
    if(messageSplit.length==3){
        var index = parseInt(messageSplit[2], 10);
        if(serverQueue != null && index>=1 && index-1<serverQueue.songs.length){
            if(index-1 == 0)
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
        var reply =  new Discord.MessageEmbed()
        .setAuthor('A na drzewach zamiast liści.. 🌴 🌲 🌳  🎵 🎵 🎵 \n', client.user.avatarURL())
        .setDescription('... \n ...\n \n Pusty portfel, pusta kolejka..')
        .setColor(0xa62019)
        return message.channel.send(reply)
    }
    
    let songList = `\`\`\`nim\n`;
    songList+=`A na drzewach zamiast liści.. 🌴 🌲 🌳  🎵 🎵 🎵 \n\n`

    let length = Math.min(10, serverQueue.songs.length)
    let maxLength=0;
    for (let i = 0; i < length; i++) {
        if(maxLength<serverQueue.songs[i].title.length)
            maxLength = serverQueue.songs[i].title.length;
    }

    console.log('max length: '+maxLength)
    if(serverQueue != null){
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

async function addSong(message, url, serverQueue) {
    checkPermissions(message)

    const songInfo = await ytdl.getInfo(url)
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
        duration: secondsToTime(songInfo.videoDetails.lengthSeconds)
    }

    if (song.title.length > 50)
        song.title = song.title.substring(0, 50) + ".."

    if (!serverQueue) {
        createQueue(message, song);
    } 
    else if(!checkIfUrlInQueue(song.url, serverQueue)){
        serverQueue.songs.push(song)

        var reply =  new Discord.MessageEmbed()
            .setDescription( `**${song.title}** stoi w kolejce po mięso w Polsce po 10 latach rządów Konfederacji! 🎵 🎵 🎵`)
            .setColor(0xa62019)
    
        return message.channel.send(reply)
    }
}

async function createQueue(message, song) {
    const voiceChannel = message.member.voice.channel;
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

    try {
        var connection = await voiceChannel.join()
        connection.voice.setSelfDeaf(true);
        queueContruct.connection = connection
        play(message.guild, queueContruct.songs[0])
    } catch (err) {
        console.log(err)
        queue.delete(message.guild.id)
        return message.channel.send(err)
    }
}

function skipCommand(message, serverQueue) {
    
    if (!message.member.voice.channel)
        return shortEmbedReply(message, `Musisz Pan na kanale być by móc pomijać!`)
    if (!serverQueue)
        return shortEmbedReply(message, `Nie ma co pomijać Panie!`)
    serverQueue.connection.dispatcher.end()
}

function skipToCommand(message, messageSplit, serverQueue) {
    if (!message.member.voice.channel)
        return shortEmbedReply(message, `Musisz Pan na kanale być by móc tyle pomijać!`)
    if (!serverQueue)
        return shortEmbedReply(message, `Nie ma co pomijać Panie!`)

    if(messageSplit.length==3){
        var index = parseInt(messageSplit[2], 10);
        if(serverQueue != null && index>=2 && index-1<serverQueue.songs.length){
            serverQueue.songs.splice(1,index-2)
            serverQueue.connection.dispatcher.end()
        }
    }
}


function stopCommand(message, serverQueue) {
    if (!message.member.voice.channel)
        return shortEmbedReply(message, `Musisz Pan na kanale być by móc kolejke usuwać!`)

    if (serverQueue==null)
        return shortEmbedReply(message, `Nie ma co zatrzymywać Panie!`)

    serverQueue.songs = []
    serverQueue.connection.dispatcher.end()
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id)
    if (!song) {
        serverQueue.voiceChannel.leave()
        queue.delete(guild.id)
        return
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on('finish', () => {
            serverQueue.songs.shift()
            play(guild, serverQueue.songs[0])
        })
        .on('error', (error) => console.error(error))
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)

    var reply =  new Discord.MessageEmbed()
        .setDescription(`Teraz gramy: **${song.title}**! 🎵 🎵 🎵`)
        .setColor(0xa62019)
        
    serverQueue.textChannel.send(reply)
}

async function playAtTop(message, url, serverQueue) { 
    checkPermissions(message);

    const songInfo = await ytdl.getInfo(url)
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    }

    if (!serverQueue) {
        createQueue(message, song);
    } else if(!checkIfUrlInQueue(song.url, serverQueue)) {
        play(message.guild, song)
        serverQueue.songs.unshift(song)
    }
}

async function getRandomLine(filename) {
    var data = await readFile(filename)
    data += ''
    var lines = data.split('\n')
    var sentence = lines[Math.floor(Math.random() * lines.length)]
    return sentence
}

function checkPermissions(message) {
    const voiceChannel = message.member.voice.channel
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
        var songs = queue.songs;
        for(let i=0; i<songs.length;i++) {
            if(songs[i].url == url) 
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
            // console.log(results[i])
            console.log(results[i].link);
            if(results[i].kind === 'youtube#video'){
                index = i;
                break;
            }
        }

        resolve(results[index].link);
        });
    })
}

// async function addPlaylist(message, messageSplit, serverQueue){
//     if(messageSplit.length>=3 && messageSplit[2].startsWith('http')) {
//         var url = messageSplit[2];
//         const startIndex = url.indexOf('list=')
//         var endIndex = url.indexOf('&index')
//         var playListId = url.substring(startIndex+5, endIndex)
        
//         console.log(playListId)
        
//         var results = await new Promise(function(resolve, reject) {
//             youtube.playlistItems.list({
//                 key: process.env.YOUTUBE_KEY,
//                 part: 'id,snippet',
//                 playlistId: playListId,
//                 maxResult: 100,
//                 }, (err, results) => {
                
//                 if(err) reject(err)

//                 resolve(results)
//             });
//         })

        
//         for(let i=0;i<results.data.items.length; i++)
//         {
//             var songUrl = basicYTUrl + results.data.items[i].snippet.resourceId.videoId
//             console.log(songUrl)
//             const serverQueue = queue.get(message.guild.id)
//             await addSong(message, songUrl, serverQueue)
//         }
//     }
// }

async function addPlaylist(message, messageSplit){
    if(messageSplit.length>=3 && messageSplit[2].startsWith('http')) {
        var url = messageSplit[2];
        const startIndex = url.indexOf('list=')
        var endIndex = url.indexOf('&index')
        var playListId = url.substring(startIndex+5, endIndex)
        
        // part: 'id,snippet',
        console.log(playListId)
        var results = await new Promise(function(resolve, reject) {
            resolve(axios.get(`https://www.googleapis.com/youtube/v3/playlistItems`, {
            params: {
                part: 'id,snippet',
                maxResults: 100,
                playlistId: playListId,
                key: process.env.YOUTUBE_KEY
            }
            }))
        });

        var songList = []
        var songsCount=0;
        var videoIds = ''
        for(let i=0;i<results.data.items.length; i++)
        {
            if(!(results.data.items[i].snippet.title === 'Private video' && results.data.items[i].snippet.description === 'This video is private.')) {
                var songUrl = basicYTUrl + results.data.items[i].snippet.resourceId.videoId
                videoIds += results.data.items[i].snippet.resourceId.videoId + ','

                const song = {
                    title: results.data.items[i].snippet.title,
                    url: songUrl,
                }
                if (song.title.length > 50)
                    song.title = song.title.substring(0, 50) + ".."

                songList.push(song)
                songsCount++;
            }
        }
        videoIds = videoIds.slice(0, -1)

        var durationResults = await new Promise(function(resolve, reject) {
            resolve(
                axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
                    params: {
                        part: 'contentDetails',
                        id: videoIds,
                        key: process.env.YOUTUBE_KEY
                    }
                })
            )
        })

        for(let i=0;i<songList.length; i++)
        {
            const serverQueue = queue.get(message.guild.id)
            
            if(i==0)
                await addSong(message, songList[i].url, serverQueue)
            else {
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
}



function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function convertIsoTime(isoTime){
    var convertedTime = ''
    isoTime = isoTime.substring(2)

    var hourIndex = isoTime.indexOf('H')
    var minIndex = isoTime.indexOf('M')
    var secIndex = isoTime.indexOf('S')
    if(hourIndex!=-1)
        convertedTime+=isoTime.substring(0,hourIndex)

    if(minIndex!=-1){
        if(hourIndex!=-1)
            convertedTime+=':'
        convertedTime+=isoTime.substring(hourIndex+1,minIndex)+':'
    }

    if(secIndex!=-1){
        var secondText = isoTime.substring(minIndex+1, isoTime.length-1)
        var secondInt = parseInt(secondText, 10)
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
    var timeStr = new Date(seconds * 1000).toISOString().substr(11, 8);

    if(seconds < 3600)
        timeStr=timeStr.substring(3, timeStr.length)

    if(seconds<600)
        timeStr=timeStr.substring(1, timeStr.length)
    return timeStr
}

function shortEmbedReply(message, reply){
    message.channel.send(new Discord.MessageEmbed().setDescription(reply).setColor(0xa62019))
}