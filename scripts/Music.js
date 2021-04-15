// APIs
const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const search = require('youtube-search');
const axios = require('axios');
const SpotifyWebApi = require('spotify-web-api-node');
const lyricsFinder = require('lyrics-finder');

// project imports
const Utils = require('./Utils');

const basicYTUrl = 'https://www.youtube.com/watch?v=';

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: 'http://www.example.com/callback'
});

const ytOptions = {
    Cookie: process.env.COOKIE
};

const opts = {
    maxResults: 5,
    key: process.env.YOUTUBE_KEY
};

const LoopState = Object.freeze({
    LoopAll:  Symbol("LoopAll"),
    LoopOne:  Symbol("LoopOne"),
    LoopNone: Symbol("LoopNone")
});

class Music {
    constructor(client){
        this.queue = new Map();
        this.client = client;
        this.loopState = LoopState.LoopNone;
        this.currentSongIndex=0;
    }

    setupSpotify(){
        spotifyApi.setAccessToken(process.env.SPOTIFY_ACCESS_TOKEN);
        this.newToken();
        setInterval(() => this.newToken(), 1000 * 60 * 60);
    }

    resume(message, serverQueue) {
        if (this.isQueueEmpty(serverQueue))
            return Utils.shortEmbedReply(message, `Nie ma co wznawiać Panie!`);
        else {
            console.log('resume');
            serverQueue.connection.dispatcher.resume();
        }
    }

    pause(message, serverQueue) {
        if (this.isQueueEmpty(serverQueue))
            return Utils.shortEmbedReply(message, `Nie ma co wstrzymywać Panie!`);
        else {
            console.log('pause');
            serverQueue.connection.dispatcher.pause();
        }
    }

    isQueueEmpty(serverQueue) {
        return !serverQueue || !serverQueue.connection || !serverQueue.connection.dispatcher || serverQueue.songs==[];
    }

    async newToken() {
        spotifyApi.clientCredentialsGrant().then(
            function (data) {
                spotifyApi.setAccessToken(data.body['access_token']);
            },
            function (err) {
                console.log(err);
            }
        );
    }

    async findLyrics(message, serverQueue) {
        if (serverQueue && serverQueue.songs !== [] && serverQueue.connection) {
            let author = '';
            let title = serverQueue.songs[0].full_title;
            if (title.includes('-')) {
                const splitTitle = title.split('-');
                author = splitTitle[0];
                title = splitTitle[1];
            }
            const titleCut = title.replace(/\(.*\)/g,"").split('ft.')[0];

            console.log(author, titleCut);
            lyricsFinder(author, titleCut).then(lyrics => {
                Utils.sendEmbeds(serverQueue.songs[0].full_title, lyrics, message);
            });
        } 
        else
            Utils.shortEmbedReply(message, 'Panie co pan, kolejka pusta przecie!');
    }

    
    async spotifyPlayList(message, url) {
        const playlist_id = url.split('playlist/')[1];
        const results = await spotifyApi.getPlaylist(playlist_id);
        const resultsLength = Math.min(5, results.body.tracks.items.length);

        for (let i = 0; i < resultsLength; i++) {
            const serverQueue = this.queue.get(message.guild.id);
            const title = results.body.tracks.items[i].track.name + ' - ' + results.body.tracks.items[i].track.artists[0].name;
            const yt_result = await this.youtubeSearchUrl(title);

            if (i === 0 && !serverQueue)
                await this.addSong(message, yt_result.link, message.member.voice.channel, serverQueue);
            else if (!this.checkIfUrlInQueue(yt_result.link)) {
                const song = {
                    title: title,
                    url: yt_result.link,
                    duration: Utils.secondsToTime(results.body.tracks.items[i].track.duration_ms / 1000)
                };
                serverQueue.songs.push(song);
            }
        }
        message.channel.send(' Queued **' + resultsLength + '** tracks');
    }

    async playCommand(message, messageSplit, messageNoPrefix, serverQueue) {
        if (messageSplit.length >= 3) {
            if (messageSplit[2].startsWith('<@!')) {
                const voiceChannel = Utils.getUserVoiceChannel(message, Utils.getUserId(messageSplit[2]));
                this.playCommandHelper(message, messageSplit, messageNoPrefix, serverQueue, 3, voiceChannel);
            } else {
                this.playCommandHelper(message, messageSplit, messageNoPrefix, serverQueue, 2, message.member.voice.channel);
            }
        }
    }

    async playCommandHelper(message, messageSplit, messageNoPrefix, serverQueue, urlIndex, voiceChannel) {
        if (messageSplit[urlIndex].startsWith('http'))
            this.addSong(message, messageSplit[urlIndex], voiceChannel, serverQueue);
        else {
            if (urlIndex === 3)
                messageNoPrefix = messageNoPrefix.replace(messageSplit[2], '');

            this.youtubeSearchUrl(messageNoPrefix.replace('play', '')).then(results => {
                console.log('url: ' + results.link);
                this.addSong(message, results.link, voiceChannel, serverQueue);
            });
        }
    }

    async showQueueCommand(message, serverQueue) {
        if (this.isQueueEmpty(serverQueue)) {
            const reply = new Discord.MessageEmbed()
                .setAuthor('A na drzewach zamiast liści.. 🌴 🌲 🌳  🎵 🎵 🎵 \n', this.client.user.avatarURL())
                .setDescription('... \n ...\n \n Pusty portfel, pusta kolejka..')
                .setColor(0xa62019);
            return message.channel.send(reply);
        }

        let songList = `\`\`\`nim\n`;
        songList += `A na drzewach zamiast liści.. 🌴 🌲 🌳  🎵 🎵 🎵 \n\n`;

        const length = Math.min(10, serverQueue.songs.length);
        let maxLength = 0;
        for (let i = 0; i < length; i++) {
            if (maxLength < serverQueue.songs[i].title.length)
                maxLength = serverQueue.songs[i].title.length;
        }

        console.log('max length: ' + maxLength);
        if (serverQueue) {
            for (let i = 0; i < length; i++) {
                if (i + 1 < 10)
                    songList += ` `;
                const spaces = Utils.createSpaces(maxLength - serverQueue.songs[i].title.length + 4);
                songList += `${(i + 1)}.\t${serverQueue.songs[i].title}${spaces}${serverQueue.songs[i].duration} \t\n`;
            }
        }
        if (serverQueue.songs.length > 10)
            songList += `\n   \t+${serverQueue.songs.length-10} tracks in queue. 🎵 \n`;

        if(this.loopState == LoopState.LoopAll)
            songList += `\n This queue is on loop!`;
        else if(this.loopState == LoopState.LoopOne)
            songList += `\n\n ${serverQueue.songs[this.currentSongIndex].full_title} is on loop!`;

        songList += `\`\`\``;

        return message.channel.send(songList);
    }

    async addSong(message, url, voiceChannel, serverQueue) {
        Utils.checkPermissions(message, voiceChannel);

        const songInfo = await ytdl.getInfo(url, {
            requestOptions: ytOptions
        });

        let title = songInfo.videoDetails.title;
        if (title.length > 50)
            title = title.slice(0, 47) + '...';

        const song = {
            title: title,
            full_title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url,
            duration: Utils.secondsToTime(songInfo.videoDetails.lengthSeconds)
        };

        if (!serverQueue) {
            this.createQueue(message, voiceChannel, song);
            serverQueue = this.queue.get(message.guild.id);
            serverQueue.songs.push(song);
        } else if (!this.checkIfUrlInQueue(song.url, serverQueue)) {
            serverQueue.songs.push(song);

            if (!this.client.voice.connections.some(conn => conn.channel.id === voiceChannel.id)) {
                console.log('hmm not connected');
                this.connectBot(message.guild.id, voiceChannel, serverQueue);
            }

            const reply = new Discord.MessageEmbed()
                .setDescription(`[${song.full_title}](${song.url}) dodano do kolejki! \t`)
                .setColor(0xa62019);

            return message.channel.send(reply);
        }
    }

    async createQueue(message, voiceChannel) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true,
        };

        this.queue.set(message.guild.id, queueContruct);

       await this.connectBot(message.guild.id, voiceChannel, this.queue.get(message.guild.id)).then(conn => {
            if (conn)
                this.playMp3(message.guild, 'data/ozjasz.mp3');
            // play(message.guild, queue.get(message.guild.id).songs[0])
        });
    }

    async deleteSongCommand(messageSplit, serverQueue) {
        if (messageSplit.length === 3) {
            const index = parseInt(messageSplit[2], 10);
            if (serverQueue && index >= 1 && index - 1 < serverQueue.songs.length) {
                if (index - 1 === 0)
                    serverQueue.connection.dispatcher.end();
                else
                    serverQueue.songs.splice(index - 1, 1);
            }
        }
    }
    
    async skipCommand(message, serverQueue) {
        if (this.isQueueEmpty(serverQueue))
            return Utils.shortEmbedReply(message, `Nie ma co pomijać Panie!`);
        serverQueue.connection.dispatcher.end();
    }

    async skipToCommand(message, messageSplit, serverQueue) {
        if (this.isQueueEmpty(serverQueue))
            return Utils.shortEmbedReply(message, `Nie ma co pomijać Panie!`);

        if (messageSplit.length === 3) {
            const index = parseInt(messageSplit[2], 10);
            if (serverQueue && index >= 2 && index - 1 < serverQueue.songs.length) {
                serverQueue.songs.splice(1, index - 2);
                serverQueue.connection.dispatcher.end();
            }
        }
    }

    async clearQueueCommand(message, serverQueue) {
        if (this.isQueueEmpty(serverQueue))
            return Utils.shortEmbedReply(message, `Nie ma co czyścić Panie!`);

        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
        this.currentSongIndex=0;
    }

    async play(guild, song) {
        const serverQueue = this.queue.get(guild.id);
        if (!song) {
            serverQueue.voiceChannel.leave();
            this.queue.delete(guild.id);
            return;
        }

        const dispatcher = serverQueue.connection
            .play(ytdl(song.url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25,
                requestOptions: ytOptions
            }), {
                highWaterMark: 1
            })
            .on('finish', () => {
                if(this.loopState==LoopState.LoopNone)
                    serverQueue.songs.shift();
                else if(this.loopState==LoopState.LoopAll)
                    this.currentSongIndex++;
                
                if(this.currentSongIndex >= serverQueue.songs.length)
                    this.currentSongIndex=0;
                
                this.play(guild, serverQueue.songs[this.currentSongIndex]);
            })
            .on('error', (error) => console.error(error));
        dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

        const reply = new Discord.MessageEmbed()
            .setDescription(`Teraz gramy: [${song.full_title}](${song.url})! \t`)
            .setColor(0xa62019);

        serverQueue.textChannel.send(reply);
    }

    async playMp3(guild, songPath) {
        const serverQueue = this.queue.get(guild.id);
        const dispatcher = serverQueue.connection.play(songPath)
            .on('finish', () => {
                if (serverQueue.songs[0] !== null)
                    this.play(guild, serverQueue.songs[0]);
            })
            .on('error', (error) => console.error(error));
        dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    }

    async playAtTop(message, voiceChannel, url, serverQueue) {
        Utils.checkPermissions(message, voiceChannel);

        const songInfo = await ytdl.getInfo(url, {
            requestOptions: ytOptions
        });
        const song = {
            title: songInfo.videoDetails.title.slice(0, 50),
            full_title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url,
            duration: Utils.secondsToTime(songInfo.videoDetails.lengthSeconds)
        };
        console.log(song);
        if (!serverQueue) {
            this.createQueue(message, voiceChannel).then(() =>{
                this.play(message.guild, song);
            });
        } else if (!this.checkIfUrlInQueue(song.url, serverQueue)) {
            this.play(message.guild, song);
            serverQueue.songs.unshift(song);
        }
    }

    checkIfUrlInQueue(url, queue) {
        if (queue !== null) {
            for (let i = 0; i < queue.songs.length; i++) {
                if (queue.songs[i].url === url)
                    return true;
            }
        }
        return false;
    }

    async connectBot(guildId, voiceChannel, queue) {
        try {
            const connection = await voiceChannel.join();
            connection.voice.setSelfDeaf(true);
            queue.connection = connection;
        } catch (err) {
            console.log(err);
            queue.delete(guildId);
            return false;
        }
        return true;
    }

    async youtubeSearchUrl(text) {
        return new Promise((resolve, reject) => {
            search(text, opts, function (err, results) {
                if (err) reject(err);

                let index = 0;
                for (let i = 0; i < results.length; i++) {
                    if (results[i].kind === 'youtube#video') {
                        index = i;
                        break;
                    }
                }
                resolve(results[index]);
            });
        });
    }

    // making 2 api calls, one for urls, titles, second for song durations
    async youtubePlaylist(message, url) {
        const startIndex = url.indexOf('list=');
        const endIndex = url.indexOf('&index');
        const playListId = url.substring(startIndex + 5, endIndex === -1 ? url.length : endIndex);

        const results = await axios.get(`https://www.googleapis.com/youtube/v3/playlistItems`, {
            params: {
                part: 'id,snippet',
                maxResults: 200,
                playlistId: playListId,
                key: process.env.YOUTUBE_KEY,
            }
        });
        
        const serverQueue = this.queue.get(message.guild.id);
        if (!serverQueue) 
            this.createQueue(message, message.member.voice.channel, null);

        console.log('songs count: ', results.data.items.length);
        const songList = [];
        let songsCount = 0;
        let videoIds = '';
        for (let i = 0; i < results.data.items.length; i++) {
            if (!(results.data.items[i].snippet.title === 'Private video' && results.data.items[i].snippet.description === 'This video is private.')) {
                const songUrl = basicYTUrl + results.data.items[i].snippet.resourceId.videoId;
                videoIds += results.data.items[i].snippet.resourceId.videoId + ',';

                const song = {
                    title: results.data.items[i].snippet.title.length > 50 ? results.data.items[i].snippet.title.slice(0, 47) + '...' : results.data.items[i].snippet.title,
                    full_title: results.data.items[i].snippet.title,
                    url: songUrl,
                };

                songList.push(song);
                songsCount++;
            }
        }
        videoIds = videoIds.slice(0, -1);

        const durationResults = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
            params: {
                part: 'contentDetails',
                id: videoIds,
                key: process.env.YOUTUBE_KEY
            }
        });

        for (let i = 0; i < songList.length; i++) {
            const serverQueue = this.queue.get(message.guild.id);
            if (i === 0 && !serverQueue)
                await this.addSong(message, songList[i].url, message.member.voice.channel, serverQueue);
            else if (!this.checkIfUrlInQueue(songList[i].url, serverQueue)) {
                const song = {
                    title: songList[i].title,
                    full_title: songList[i].full_title,
                    url: songList[i].url,
                    duration: Utils.convertIsoTime(durationResults.data.items[i].contentDetails.duration)
                };
                serverQueue.songs.push(song);
            }
        }
        message.channel.send(' Queued **' + songsCount + '** tracks');
    }

    getRandomOzjasz() {
        const jaszczurUrl = 'https://www.youtube.com/watch?v=aZ5mQhDrnwc';
        const ozjaszEinReichUrl = 'https://www.youtube.com/watch?v=_FU--EfPmJ0';
        const jaszczur2Url = 'https://www.youtube.com/watch?v=V0hwtnJ5YAo';
        const jaszczur3Url = 'https://www.youtube.com/watch?v=brgjTUh8eZM&ab_channel=Nigdysi%C4%99niepoddawaj';
        const major = 'https://www.youtube.com/watch?v=2vQhOH_oBHE&ab_channel=Wkl%C4%99s%C5%82yMajorSuchodolski&fbclid=IwAR07n6SQrbsKlYsgRiZ0wnafsDjMvjlXV02psGwEP8gnbxpdmqE5RX0oXZY';
        const intermajor = 'https://www.youtube.com/watch?v=QP-N54BPz4Q';

        const urls = [jaszczurUrl, jaszczur2Url, jaszczur3Url, ozjaszEinReichUrl, major, intermajor];
        return urls[Math.floor(Math.random() * urls.length)];
    }
}

module.exports.Music = Music;
module.exports.LoopState = LoopState;
