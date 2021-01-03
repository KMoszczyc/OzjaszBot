console.log('beep beep! ')
require('dotenv').config();

const fs = require('fs');
const Discord = require('discord.js');
const ytdl = require("ytdl-core");

const client = new Discord.Client();
const prefix = '!oz'
const queue = new Map();

client.login(process.env.TOKEN);

client.on('ready', readyDiscord);
client.on('message', gotMessage);

function readyDiscord() {
    console.log('its ready already!')
}

function gotMessage(message) {
    console.log(message.content)
    let s = message.content;

    const serverQueue = queue.get(message.guild.id);
  
    //easter egg - paróweczki
    if(message.content.includes('rynek')) {
      var url = 'https://www.youtube.com/watch?v=a9bBEbAO8Ik';
      playAtTop(message, url);
    }

    //commands
    if (message.content.startsWith(`${prefix}play`)) {
      execute(message, serverQueue);
      return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
      skip(message, serverQueue);
      return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
      stop(message, serverQueue);
      return;
    } 
    else if(message.content.startsWith(`${prefix}queue`)) {
      getQueue(message, serverQueue);
    }
    else if(message.content.startsWith(`${prefix}help`)) {
      commandList(message);
    }

    if (message.content.startsWith(prefix)){
      getRandomLine(message, 'ozjasz-wypowiedzi.txt');
    }

    if (message.content.startsWith('!boczek')){
      replyWithRandomLine(message, 'boczek-epitety.txt');
    }
}

function joinChannel(){
  const channel = client.channels.cache.get("692759541187739668");
  if (!channel) return console.error("The channel does not exist!");
  channel.join().then(connection => {
    // Yay, it worked!
    console.log("Successfully connected.");
  }).catch(e => {
    // Oh no, it errored! Let's log it to console :)
    console.error(e);
  });
}

function commandList(message) {
  var reply = 'Komendy: \n !oz \n !ozplay \n !ozskip \n !ozstop \n !ozqueue \n !ozhelp \n'
  return message.channel.send(reply);
}

async function getQueue(message, serverQueue) {
  const voiceChannel = message.member.voice.channel;
  let songList = 'A na drzewach zamiast liści..: \n';
  for(let i=0;i<serverQueue.songs.length;i++)
  {
    songList += (i+1).toString()+ '. '+ serverQueue.songs[i].title + '\n'
  }
  console.log(songList)
  return message.channel.send(songList);
}

async function execute(message, serverQueue) {
  const args = message.content.split(" ");

  checkPermissions(message);

  const songInfo = await ytdl.getInfo(args[1]);
  const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    };

  if (!serverQueue) {
    createQueue();
  } else {
    serverQueue.songs.push(song);
    return message.channel.send(`${song.title} has been added to the queue!`);
  }
}

function createQueue(message, song){
  const queueContruct = {
    textChannel: message.channel,
    voiceChannel: voiceChannel,
    connection: null,
    songs: [],
    volume: 5,
    playing: true
  };

  queue.set(message.guild.id, queueContruct);

  queueContruct.songs.push(song);

  try {
    var connection = await voiceChannel.join();
    queueContruct.connection = connection;
    play(message.guild, queueContruct.songs[0]);
  } catch (err) {p
    console.log(err);
    queue.delete(message.guild.id);
    return message.channel.send(err);
  }
}

function skip(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  if (!serverQueue)
    return message.channel.send("There is no song that I could skip!");
  serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
    
  if (!serverQueue)
    return message.channel.send("There is no song that I could stop!");
    
  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  const dispatcher = serverQueue.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", error => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}


function playAtTop(message, serverQueue) {
  const songInfo = await ytdl.getInfo(url);
  const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    };

    serverQueue.songs.unshift(song);
}

function getRandomLine(message, filename){
  var sentence = ''
  fs.readFile(filename, function(err, data){
    if(err) throw err;
    data +='';
    var lines = data.split('\n');
    sentence = lines[Math.floor(Math.random()*lines.length)];
    message.channel.send(sentence)
  });
}

function replyWithRandomLine(message, filename){
  var sentence = ''
  fs.readFile(filename, function(err, data){
    if(err) throw err;
    data +='';
    var lines = data.split('\n');
    sentence = 'to '+ lines[Math.floor(Math.random()*lines.length)];
    message.reply(sentence)
  });
}

function checkPermissions(message) {
  const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
      return message.channel.send(
        "You need to be in a voice channel to play music!"
      );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
      return message.channel.send(
        "I need the permissions to join and speak in your voice channel!"
      );
    }
}