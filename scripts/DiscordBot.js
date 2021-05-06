require('dotenv').config();

// APIs
const Discord = require('discord.js');
const axios = require('axios');
const translate = require('translation-google');

// project imports
const Utils = require('./Utils');
const Music = require('./Music');

console.log('beep beep! ');

module.exports = class DiscordBot {
    constructor() {
        this.client = new Discord.Client();
        this.music = new Music.Music(this.client);
        this.prefix = '-';

        this.client.login(process.env.TOKEN);
        this.client.on('ready', this.readyDiscord.bind(this));
        this.client.on('message', this.gotMessage.bind(this));
        this.client.on('voiceStateUpdate', (oldMember, newMember) => this.voiceStateUpdate(oldMember, newMember));
    }

    readyDiscord() {
        console.log('its ready already!');
        this.client.user.setActivity(`${this.prefix}help`, {
            type: 'PLAYING'
        });
        this.music.setupSpotify();
    }

    async voiceStateUpdate(oldMember, newMember) {
        const oldVoice = oldMember.channelID;
        const newVoice = newMember.channelID;

        if (oldVoice !== newVoice && oldVoice === null && newMember.id === this.client.user.id) {
            console.log("Ozjasz bot joined!");
            const serverQueue = this.music.queue.get(newMember.guild.id);
            if (serverQueue && serverQueue.songs !== [] && serverQueue.connection !== null) {
                this.music.connectBot(newMember.guild.id, newMember.channel, serverQueue).then(conn => {
                    if (conn)
                        this.play(newMember.guild, serverQueue.songs[0]);
                });
            }
        }
    }

    async gotMessage(message) {
        console.log(message.content);
        const serverQueue = this.music.queue.get(message.guild.id);
        
        if(message.content.substring(0,3) === '!oz')
            Utils.shortEmbedReply(message, `!oz is gone, now ${this.prefix} is the new command`);

        if(message.content[0] === this.prefix) {
            const messageNoPrefix = message.content.substring(this.prefix.length);
            const messageSplit = messageNoPrefix.split(' ');

            console.log(messageSplit);
            switch (messageSplit[0]) {
                case 'p':
                case `play`:
                    this.music.playCommand(message, messageSplit, messageNoPrefix, serverQueue);
                    break;
                case 'pt':
                case 'playtop':
                    this.music.playAtTopCommand(message, messageSplit, messageNoPrefix, serverQueue);
                    break;
                case 's':
                case `skip`:
                    this.music.skipCommand(message, serverQueue);
                    break;
                case `skipto`:
                    this.music.skipToCommand(message, messageSplit, serverQueue);
                    break;
                case 'shuffle':
                    Utils.shuffleArray(serverQueue.songs);
                    this.music.play(message.guild, serverQueue.songs[serverQueue.currentSongIndex]);
                    break;
                case 'pause':
                    this.music.pause(message, serverQueue);
                    break;
                case 'resume':
                    this.music.resume(message, serverQueue);
                    break;
                case 'c':
                case `clear`:
                    this.music.clearQueueCommand(message, serverQueue);
                    break;
                case 'q':
                case `queue`:
                    this.music.showQueueCommand(message, serverQueue);
                    break;
                case 'd':
                case 'delete':
                    this.music.deleteSongCommand(message, messageSplit, serverQueue);
                    break;
                case 'l':
                case 'loop':
                    serverQueue.loopState = Music.LoopState.LoopAll;
                    Utils.shortEmbedReply(message, 'We are looping now!');
                    break;
                case 'loopone':
                    serverQueue.loopState = Music.LoopState.LoopOne;
                    Utils.shortEmbedReply(message, 'We are looping current song!');
                    break;
                case 'lo':
                case 'loopoff':
                    serverQueue.loopState = Music.LoopState.LoopOff;
                    Utils.shortEmbedReply(message, 'We are not looping anymore.');
                    break;
                case 'h':
                case `help`:
                    this.commandList(message);
                    break;
                case 'b':
                case 'boczek':
                    Utils.getRandomLine("./data/boczek-epitety.txt").then(sentence => {
                        message.channel.send(messageNoPrefix.split('boczek ').join('') + ' to ' + sentence);
                    });
                    break;
                case 'instrukcja':
                    Utils.getRandomLine("./data/instrukcja-lol.txt").then(sentence => {
                        message.channel.send(sentence);
                    });
                    break;
                case 'random':
                    if (messageSplit.length === 3) {
                        const voiceChannel = Utils.getUserVoiceChannel(message, Utils.getUserId(messageSplit[2]));
                        this.music.playAtTop(message, voiceChannel, this.music.getRandomOzjasz(), serverQueue);
                    } else
                        this.music.playAtTop(message, message.member.voice.channel, this.music.getRandomOzjasz(), serverQueue);
                    break;
                case 'join':
                    message.member.voice.channel.join();
                    this.music.createQueue(message, message.member.voice.channel, null);
                    break;
                case 'guess':
                    this.predictSentiment(message, messageNoPrefix.split('guess').join(''));
                    break;
                case 'ly':
                case 'lyrics':
                    this.music.findLyrics(message, serverQueue);
                    break;
                case 'o':
                case 'ozjasz':
                    Utils.getRandomLine("./data/ozjasz-wypowiedzi.txt").then(sentence => {
                        message.channel.send(sentence);
                    });
                    break;
                default:
                    this.commandList(message);
            }
        }
    }

    async predictSentiment(message, sentence) {
        try {
            const englishSentence = await translate(sentence, {
                from: 'pl',
                to: 'en'
            });
            console.log(englishSentence.text);

            const results = await axios.post('https://sentiment-prediction-deepl.herokuapp.com/predict', {
                text: englishSentence.text
            });
            console.log(results.data[0]);
            let response = results.data[0].prediction === 0 ? 'negative' : 'positive';
            response += ' - ' + Math.floor(results.data[0].probability * 100) + '%';

            message.channel.send(response);
        } catch (e) {
            console.log(e);
        }
    }

    async commandList(message) {
        const reply = new Discord.MessageEmbed()
            .setAuthor('Oto komendy.. \n', this.client.user.avatarURL())
            .addField('Music 🎵', `${this.prefix}play (${this.prefix}p) [tytuł lub url] \n  ${this.prefix}play [@nick kogoś] [tytuł lub url] \n ${this.prefix}playtop (${this.prefix}pt) [tytuł lub url] \n  ${this.prefix}playtop [@nick kogoś] [tytuł lub url] \n ${this.prefix}skip (${this.prefix}s)  \n ${this.prefix}skipto [index] \n ${this.prefix}pause \n ${this.prefix}resume  \n ${this.prefix}clear  \n ${this.prefix}queue (${this.prefix}q) \n ${this.prefix}delete [index] \n ${this.prefix}lyrics \n ${this.prefix}loop (${this.prefix}l) \n ${this.prefix}loopone \n ${this.prefix}loopoff (${this.prefix}lo)` , true)
            .setColor(0xa62019)
            .addField('Inne 🥓', `${this.prefix}ozjasz (${this.prefix}o)  \n ${this.prefix}boczek [coś] 🥓 \n ${this.prefix}guess [coś] \n ${this.prefix}instrukcja \n ${this.prefix}random \n ${this.prefix}random [@nick] \n ${this.prefix}help \n`, true);

        return message.channel.send(reply);
    }
};