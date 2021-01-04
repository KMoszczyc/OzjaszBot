const rafonUrl = 'https://www.youtube.com/watch?v=CvgG4nYoyUc'
const rynekUrl = 'https://www.youtube.com/watch?v=a9bBEbAO8Ik'
const stonogaUrl = 'https://www.youtube.com/watch?v=3KtVI3hRjc0'

console.log('beep beep! ')
require('dotenv').config()
const fs = require('fs')

const Discord = require('discord.js')
const ytdl = require('ytdl-core')
var search = require('youtube-search');

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
    console.log(myRnId())
}

function gotMessage(message) {
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
                case `skip`:
                    skipCommand(message, serverQueue)
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
                        message.channel.send(messageNoPrefix.split('boczek ').join('')+ ' to '+ sentence)
                    })
                    break;  
                case 'instrukcja':
                    getRandomLine("instrukcja-lol.txt").then(sentence => {
                        message.channel.send(sentence)
                    })
                    break;    
                default:
                    message.channel.send('Ma Pan dowód, że Hitler wiedział o takiej komendzie?  <:svastika:795768023465590824> <:lol:795769330154864670>');
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
            execute(message, messageSplit[2], serverQueue)
        else {
            youtubeSearchUrl(messageNoPrefix.replace('play','')).then( url => {
                console.log('url: ' + url)
                execute(message, url, serverQueue)
            })
        }
    }
}

function commandList(message) {
    var reply = 'Komendy: \n !oz \n !oz play <tytuł lub url> \n !oz skip \n !oz stop \n !oz queue \n !oz delete <index>\n !oz boczek <coś>\n !oz instrukcja \n !oz help \n'
    return message.channel.send(reply)
}

function deleteSongCommand(messageSplit, serverQueue){
    if(messageSplit.length==3){
        var index = parseInt(messageSplit[2], 10);
        if(serverQueue != null && index-1<serverQueue.songs.length){
            if(index-1 == 0)
                serverQueue.connection.dispatcher.end()
            else
                serverQueue.songs.splice(index-1, 1);
        }
    }
}

async function getQueueCommand(message, serverQueue) {
    let songList = 'A na drzewach zamiast liści..: \n'; 
    if(serverQueue != null){
        for (let i = 0; i < serverQueue.songs.length; i++) {
            songList +=
                (i + 1).toString() + '. \t' + serverQueue.songs[i].title + '\n'
        }
    }

    console.log(songList)
    return message.channel.send(songList)
}

async function execute(message, url, serverQueue) {
    checkPermissions(message)

    const songInfo = await ytdl.getInfo(url)
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    }

    if (!serverQueue) {
        createQueue(message, song);
    } 
    else if(!checkIfUrlInQueue(song.url, serverQueue)){
        serverQueue.songs.push(song)
        return message.channel.send(
            `${song.title} has been added to the queue!`
        )
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
        return message.channel.send('You have to be in a voice channel to stop the music!')
    if (!serverQueue)
        return message.channel.send('There is no song that I could skip!')
    serverQueue.connection.dispatcher.end()
}

function stopCommand(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send('You have to be in a voice channel to stop the music!')

    if (!serverQueue)
        return message.channel.send('There is no song that I could stop!')

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
    serverQueue.textChannel.send(`Start playing: **${song.title}**`)
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