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
    headers: {
        cookie: process.env.COOKIE,
        "x-youtube-identity-token": process.env.YOUTUBE_KEY
    }
};

const opts = {
    maxResults: 10,
    key: process.env.YOUTUBE_KEY,
    regionCode: 'US'
};

const LoopState = Object.freeze({
    LoopAll:  "LoopAll",
    LoopOne:  "LoopOne",
    LoopOff: "LoopOff"
});

const max_spotify_songs_num = 30;

class Music {
    constructor(client){
        this.queue = new Map();
        this.client = client;
        this.timeoutTime = 120 * 1000   // 2 minutes
    }

    setupSpotify(){
        spotifyApi.setAccessToken(process.env.SPOTIFY_ACCESS_TOKEN);
        this.newToken();
        setInterval(() => this.newToken(), 1000 * 60 * 60);
    }

    resume(message, serverQueue) {
        if (this.isQueueEmpty(serverQueue))
            return Utils.shortEmbedReply(message.channel, `There is nothing to resume!`);
        else {
            console.log('resume');
            serverQueue.connection.dispatcher.resume();
        }
    }

    pause(message, serverQueue) {
        if (this.isQueueEmpty(serverQueue))
            return Utils.shortEmbedReply(message.channel, `There is nothing to pause!`);
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
            let titleCut = title.replace(/\(.*\)/g,"").split('ft.')[0];
            titleCut = title.replace(/\[.*\]/g,"").split('ft.')[0];

            console.log(author, titleCut);
            lyricsFinder(author, titleCut).then(lyrics => {
                Utils.sendEmbeds(serverQueue.songs[0].full_title, lyrics, message);
            });
        } 
        else
            Utils.shortEmbedReply(message.channel, 'Hey man, the queue is empty! 🐒');
    }

    async spotifyPlayList(message, url) {
        const playlist_id = url.split('playlist/')[1];
        const results = await spotifyApi.getPlaylist(playlist_id);
        const resultsLength = Math.min(max_spotify_songs_num, results.body.tracks.items.length);

        for (let i = 0; i < resultsLength; i++) {
            const serverQueue = this.queue.get(message.guild.id);
            const title = results.body.tracks.items[i].track.name + ' - ' + results.body.tracks.items[i].track.artists[0].name;
            const yt_result = await this.youtubeSearchUrl(title);

            if (i === 0 && !serverQueue)
                await this.addSong(message, yt_result.link, message.member.voice.channel, serverQueue);
            else if (!Music.checkIfUrlInQueue(yt_result.link, serverQueue)) {
                const song = {
                    title: title,
                    full_title: title,
                    url: yt_result.link,
                    duration: Utils.secondsToTime(results.body.tracks.items[i].track.duration_ms / 1000)
                };
                serverQueue.songs.push(song);
            }
        }
        message.channel.send(' Queued **' + resultsLength + '** tracks');
    }

    async playCommand(message, messageSplit, messageNoPrefix, serverQueue) {
        if (messageSplit.length >= 2) {
            if (messageSplit[1].startsWith('<@!')) {
                const voiceChannel = Utils.getUserVoiceChannel(message, Utils.getUserId(messageSplit[1]));
                this.playCommandHelper(message, messageSplit, messageNoPrefix, serverQueue, 2, voiceChannel);
            } else {
                this.playCommandHelper(message, messageSplit, messageNoPrefix, serverQueue, 1, message.member.voice.channel);
            }
        }
    }

    async playCommandHelper(message, messageSplit, messageNoPrefix, serverQueue, urlIndex, voiceChannel) {
        if (messageSplit[urlIndex].startsWith('http')){
            if(messageSplit[urlIndex].includes('&list='))
                this.youtubePlaylist(message, messageSplit[urlIndex]);
            else if(messageSplit[urlIndex].startsWith('https://open.spotify.com/playlist/'))
                this.spotifyPlayList(message, messageSplit[urlIndex]);
            else
                this.addSong(message, messageSplit[urlIndex], voiceChannel, serverQueue);
        }
        else {
            if (urlIndex === 2)
                messageNoPrefix = messageNoPrefix.replace(messageSplit[1], '');
            
            this.youtubeSearchUrl(messageNoPrefix.replace(messageSplit[0], ''), serverQueue).then(results => {
                console.log('url: ' + results.link);
                this.addSong(message, results.link, voiceChannel, serverQueue);
            });
        }
    }

    async playAtTopCommand(message, messageSplit, messageNoPrefix, serverQueue) {
        if (messageSplit.length >= 2) {
            if (messageSplit[1].startsWith('<@!')) {
                const voiceChannel = Utils.getUserVoiceChannel(message, Utils.getUserId(messageSplit[1]));
                this.playAtTopCommandHelper(message, messageSplit, messageNoPrefix, serverQueue, 2, voiceChannel);
            } else {
                this.playAtTopCommandHelper(message, messageSplit, messageNoPrefix, serverQueue, 1, message.member.voice.channel);
            }
        }
    }

    async playAtTopCommandHelper(message, messageSplit, messageNoPrefix, serverQueue, urlIndex, voiceChannel){
        if (messageSplit[urlIndex].startsWith('http'))
            this.playAtTop(message.guild, message.channel, voiceChannel, messageSplit[urlIndex], serverQueue);
        else {
            if (urlIndex === 2)
                messageNoPrefix = messageNoPrefix.replace(messageSplit[1], '');
            
            this.youtubeSearchUrl(messageNoPrefix.replace(messageSplit[0], ''), serverQueue).then(results => {
                console.log('url: ' + results.link);
                this.playAtTop(message.guild, message.channel, voiceChannel, results.link, serverQueue);
            });
        }
    }

    async showQueueCommand(message, serverQueue) {
        if (this.isQueueEmpty(serverQueue)) {  
            const reply = new Discord.MessageEmbed()  
                .setAuthor('Thats the queue..  🎵 🐒 🌴 🍌 \n', this.client.user.avatarURL())
                .setDescription('... \n ...\n \n .. But the queue is empty 🤷‍♀️')
                .setColor(0xa62019);
            return message.channel.send(reply);
        }

        let songList = `\`\`\`nim\n`;
        songList += `Thats the queue..  🎵 🐒 🌴 🍌  \n\n`;

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

        if(serverQueue.loopState == LoopState.LoopAll)
            songList += `\n This queue is on loop!`;
        else if(serverQueue.loopState == LoopState.LoopOne)
            songList += `\n\n ${serverQueue.songs[serverQueue.currentSongIndex].full_title} is on loop!`;

        songList += `\`\`\``;

        return message.channel.send(songList);
    }

    async addSong(message, url, voiceChannel, serverQueue) {
        Utils.checkPermissions(message, voiceChannel);

        let songInfo = null
        try {
            songInfo = await ytdl.getInfo(url, {
                requestOptions: ytOptions
            });
        }
        catch(error){
            console.error('error')
            return Utils.shortEmbedReply(message.channel, `This song is 🔞  feelsbadman`);
        }

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
            this.createQueue(message.guild, voiceChannel, message.channel);
            serverQueue = this.queue.get(message.guild.id);
            serverQueue.songs.push(song);
        } else if (!Music.checkIfUrlInQueue(song.url, serverQueue)) {
            serverQueue.songs.push(song);

            if (!this.client.voice.connections.some(conn => conn.channel.id === voiceChannel.id)) {
                this.connectBot(message.guild.id, voiceChannel, serverQueue);
            }

            const reply = new Discord.MessageEmbed()
                .setDescription(`[${song.full_title}](${song.url}) added to queue!  👀 \t`)
                .setColor(0xa62019);

            return message.channel.send(reply);
        }
    }

    async createQueue(guild, voiceChannel, textChannel=null) {
        const queueContruct = {
            textChannel: textChannel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true,
            loop: LoopState.LoopOff,
            currentSongIndex: 0,
            leaveTimer: null 
        };
        this.queue.set(guild.id, queueContruct);

        // ?????
        const serverQueue = this.queue.get(guild.id);
        serverQueue.loopState = LoopState.LoopOff;

       await this.connectBot(guild.id, voiceChannel, this.queue.get(guild.id)).then(conn => {
            if (conn)
                this.playMp3(guild, 'data/ozjasz.mp3');
            // play(message.guild, queue.get(message.guild.id).songs[0])
        });
    }

    async deleteSongCommand(message, messageSplit, serverQueue) {
        if (messageSplit.length === 2) {
            const index = parseInt(messageSplit[1], 10);
            if (serverQueue && index >= 1 && index - 1 < serverQueue.songs.length) {
                const song = serverQueue.songs[index-1];
                if (index - 1 === 0)
                    serverQueue.connection.dispatcher.end();
                else
                    serverQueue.songs.splice(index - 1, 1);

                return Utils.shortEmbedReply(message.channel, `[${song.full_title}](${song.url}) deleted from queue! 💀\t`  );
            }
        }
    }
    
    async skipCommand(message, serverQueue) {
        if (this.isQueueEmpty(serverQueue))
            return Utils.shortEmbedReply(message.channel, `There is nothing to skip! 🐵`);
        serverQueue.connection.dispatcher.end();
    }

    async skipToCommand(message, messageSplit, serverQueue) {
        if (this.isQueueEmpty(serverQueue))
            return Utils.shortEmbedReply(message.channel, `There is nothing to skip! 🐵`);

        if (messageSplit.length === 2) {
            const index = parseInt(messageSplit[1], 10);
            if (serverQueue && index >= 2 && index - 1 < serverQueue.songs.length) {
                serverQueue.songs.splice(1, index - 2);
                serverQueue.connection.dispatcher.end();
            }
        }
    }

    async clearQueueCommand(message, serverQueue) {
        if (this.isQueueEmpty(serverQueue))
            return Utils.shortEmbedReply(message.channel, `There is nothing to skip! 🐒`);

        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
        serverQueue.currentSongIndex=0;
    }

    async play(guild, song, skip_seconds=0) {
        const serverQueue = this.queue.get(guild.id);
        if (!song) {
            serverQueue.leaveTimer = setTimeout(() => {
                this.leaveWithTimeout(guild.id);
              }, this.timeoutTime); 
            return;
        }

        // clear timer before set
        try {
            clearTimeout(serverQueue.leaveTimer);
        } catch(e) {
            // there's no leaveTimer
        }

        let dispatcher = null
        try {
            dispatcher = serverQueue.connection
                .play(ytdl(song.url, {
                    filter: 'audioonly',
                    quality: 'highestaudio',
                    highWaterMark: 1 << 25,
                    requestOptions: ytOptions
                }), {
                    highWaterMark: 1,
                    seek: skip_seconds
                })
                .on('finish', () => {
                    if(serverQueue.loopState == LoopState.LoopOff)
                        serverQueue.songs.shift();
                    else if(serverQueue.loopState == LoopState.LoopAll)
                        serverQueue.currentSongIndex++;
                    
                    if(serverQueue.currentSongIndex >= serverQueue.songs.length)
                        serverQueue.currentSongIndex=0;
                    
                    this.play(guild, serverQueue.songs[serverQueue.currentSongIndex]);
                })
                .on('error', (error) => console.error(error));

            dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
        }
        catch(error){
            console.error(error)
            return Utils.shortEmbedReply(message.channel, `This song is 🔞 feelsbadman`);
        }


        const reply = new Discord.MessageEmbed()
            .setDescription(`We're playing: [${song.full_title}](${song.url})!   🐒\t`)
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

    async playAtTop(guild, textChannel, voiceChannel, url, serverQueue=null, skip_seconds=0) {
        // Utils.checkPermissions(message, voiceChannel);

        let songInfo = null
        // check if song is +18 or private
        try {
            songInfo = await ytdl.getInfo(url, {
                requestOptions: ytOptions
            });
        }
        catch(error){
            console.error('error')
            return Utils.shortEmbedReply(textChannel, `This song is 🔞 feelsbadman`);
        }

        const song = {
            title: songInfo.videoDetails.title.slice(0, 50),
            full_title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url,
            duration: Utils.secondsToTime(songInfo.videoDetails.lengthSeconds)
        };

        if (!serverQueue) {
            this.createQueue(guild, voiceChannel, textChannel).then(() =>{
                this.play(guild, song, skip_seconds);
                serverQueue = this.queue.get(guild.id);
                serverQueue.songs.push(song);
            });
        } else if (!Music.checkIfUrlInQueue(song.url, serverQueue)) {
            this.play(guild, song, skip_seconds);
            serverQueue.songs.unshift(song);
        }
    }

    static checkIfUrlInQueue(url, serverQueue) {
        if (serverQueue !== null) {
            for (let i = 0; i < serverQueue.songs.length; i++) {
                if (serverQueue.songs[i].url === url)
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

    async youtubeSearchUrl(text, serverQueue) {
        return new Promise((resolve, reject) => {
            search(text, opts, function (err, results) {
                if (err) reject(err);

                let index = 0;
                for (let i = 0; i < results.length; i++) {
                    if (results[i].kind === 'youtube#video') {
                        if(serverQueue!=undefined && Music.checkIfUrlInQueue(results[i].link, serverQueue))
                            continue;

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
        const endIndexV2 = url.indexOf('&start_radio');
        let finalEndIndex;

        if(endIndex==-1 && endIndexV2==-1)
            finalEndIndex = url.length;
        else if(endIndex!=-1)
            finalEndIndex = endIndex;
        else if(endIndexV2!=-1)
            finalEndIndex = endIndexV2;


        const playListId = url.substring(startIndex + 5, finalEndIndex);

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
            this.createQueue(message.guild, message.member.voice.channel, message.channel);

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
            else if (!Music.checkIfUrlInQueue(songList[i].url, serverQueue)) {
                const song = {
                    title: songList[i].title,
                    full_title: songList[i].full_title,
                    url: songList[i].url,
                    duration: Utils.convertIsoTime(durationResults.data.items[i].contentDetails.duration)
                };
                serverQueue.songs.push(song);
            }
        }
        message.channel.send('🐒 Queued **' + songsCount + '** tracks');
    }

    getRandomOzjasz() {
        const urls = [
            'https://www.youtube.com/watch?v=aZ5mQhDrnwc',
            'https://www.youtube.com/watch?v=_FU--EfPmJ0',
            'https://www.youtube.com/watch?v=V0hwtnJ5YAo',
            'https://www.youtube.com/watch?v=brgjTUh8eZM&ab_channel=Nigdysi%C4%99niepoddawaj',
            'https://www.youtube.com/watch?v=2vQhOH_oBHE&ab_channel=Wkl%C4%99s%C5%82yMajorSuchodolski&fbclid=IwAR07n6SQrbsKlYsgRiZ0wnafsDjMvjlXV02psGwEP8gnbxpdmqE5RX0oXZY',
            'https://www.youtube.com/watch?v=QP-N54BPz4Q'
        ];

        return urls[Math.floor(Math.random() * urls.length)];
    }

    randomTusk(){
        const urls = [
            'https://www.youtube.com/watch?v=AwICmvGya64',
            'https://www.youtube.com/watch?v=bPWuQ_-Uw6Y'
        ]
        return urls[Math.floor(Math.random() * urls.length)];
    }

    leaveWithTimeout(guildID) {
        const serverQueue = this.queue.get(guildID);
        if(serverQueue) {
            Utils.shortEmbedReply(serverQueue.textChannel, `2 minutes of inactivity. Tschüss, auf wiedersehen!`)
            serverQueue.voiceChannel.leave();
            this.queue.delete(guildID);
        }
    }
}

module.exports.Music = Music;
module.exports.LoopState = LoopState;
