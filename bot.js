const rafonUrl = 'https://www.youtube.com/watch?v=CvgG4nYoyUc'
const rynekUrl = 'https://www.youtube.com/watch?v=a9bBEbAO8Ik'
const stonogaUrl = 'https://www.youtube.com/watch?v=3KtVI3hRjc0'

console.log('beep beep! ')
require('dotenv').config()
const fs = require('fs')

const Discord = require('discord.js')
const ytdl = require('ytdl-core')

const client = new Discord.Client()
const prefix = '!oz'
const queue = new Map()

client.login(process.env.TOKEN)

client.on('ready', readyDiscord)
client.on('message', gotMessage)

function readyDiscord() {
    console.log('its ready already!')
}

function gotMessage(message) {
    console.log(message.content)
    const serverQueue = queue.get(message.guild.id)

    //easter egg - paróweczki
    if (message.content.toLowerCase().includes('rynek')) {
        playAtTop(message, rynekUrl, serverQueue)
    }
    else if (message.content.toLowerCase().includes('rafon')) {
        playAtTop(message, rafonUrl, serverQueue)
    }
    else if (message.content.toLowerCase().includes('pis')) {
        playAtTop(message, stonogaUrl, serverQueue)
    }

    if(message.content.startsWith(`${prefix}`)) {
        var messageNoPrefix = message.content.split('!oz ').join('');
        console.log(messageNoPrefix)
        if (messageNoPrefix.startsWith(`play`)) {
            execute(message, serverQueue)
        } else if (messageNoPrefix.startsWith(`skip`)) {
            skip(message, serverQueue)
        } else if (messageNoPrefix.startsWith(`stop`)) {
            stop(message, serverQueue)
        } else if (messageNoPrefix.startsWith(`queue`)) {
            getQueue(message, serverQueue)
        } else if (messageNoPrefix.startsWith(`help`)) {
            commandList(message)
        }

        if (messageNoPrefix.startsWith('boczek')) {
            getRandomLine("boczek-epitety.txt").then(sentence => {
                message.channel.send(messageNoPrefix.split('boczek ').join('')+ ' to '+ sentence)
            })
        } else if (message.content.startsWith(prefix)) {
            getRandomLine("ozjasz-wypowiedzi.txt").then(sentence => {
                message.channel.send(sentence)
            })
        }
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

function commandList(message) {
    var reply = 'Komendy: \n !oz \n !oz play <url>\n !oz skip \n !oz stop \n !oz queue \n !oz boczek <coś>\n !oz help \n'
    return message.channel.send(reply)
}

async function getQueue(message, serverQueue) {
    let songList = 'A na drzewach zamiast liści..: \n';
    for (let i = 0; i < serverQueue.songs.length; i++) {
        songList +=
            (i + 1).toString() + '. \t' + serverQueue.songs[i].title + '\n'
    }
    console.log(songList)
    return message.channel.send(songList)
}

async function execute(message, serverQueue) {
    const args = message.content.split(' ')

    checkPermissions(message)

    const songInfo = await ytdl.getInfo(args[2])
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

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send('You have to be in a voice channel to stop the music!')
    if (!serverQueue)
        return message.channel.send('There is no song that I could skip!')
    serverQueue.connection.dispatcher.end()
}

function stop(message, serverQueue) {
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
