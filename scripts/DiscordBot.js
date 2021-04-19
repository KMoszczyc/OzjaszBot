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
        this.prefix = '!oz';

        this.client.login(process.env.TOKEN);
        this.client.on('ready', this.readyDiscord.bind(this));
        this.client.on('message', this.gotMessage.bind(this));
        this.client.on('voiceStateUpdate', (oldMember, newMember) => this.voiceStateUpdate(oldMember, newMember));
    }

    readyDiscord() {
        console.log('its ready already!');
        this.client.user.setActivity('!oz help', {
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
        

        const messageSplit = message.content.split(' ');
        if (messageSplit[0] === this.prefix) {
            const messageNoPrefix = message.content.split(this.prefix + ' ').join('');

            if (messageSplit.length <= 1) {
                Utils.getRandomLine("./data/ozjasz-wypowiedzi.txt").then(sentence => {
                    message.channel.send(sentence);
                });
            } else {
                switch (messageSplit[1]) {
                    case `play`:
                        this.music.playCommand(message, messageSplit, messageNoPrefix, serverQueue);
                        break;
                    case `playlist`:
                        if (messageSplit.length === 3 && messageSplit[2].startsWith('https://www.youtube.com/'))
                            this.music.youtubePlaylist(message, messageSplit[2]);
                        else if (messageSplit.length === 3 && messageSplit[2].startsWith('https://open.spotify.com/playlist/'))
                            this.music.spotifyPlayList(message, messageSplit[2]);
                        break;
                    case `skip`:
                        this.music.skipCommand(message, serverQueue);
                        break;
                    case `skipto`:
                        this.music.skipToCommand(message, messageSplit, serverQueue);
                        break;
                    case 'pause':
                        this.music.pause(message, serverQueue);
                        break;
                    case 'resume':
                        this.music.resume(message, serverQueue);
                        break;
                    case `clear`:
                        this.music.clearQueueCommand(message, serverQueue);
                        break;
                    case `queue`:
                        this.music.showQueueCommand(message, serverQueue);
                        break;
                    case 'delete':
                        this.music.deleteSongCommand(messageSplit, serverQueue);
                        break;
                    case 'loop':
                        serverQueue.loopState = Music.LoopState.LoopAll;
                        Utils.shortEmbedReply(message, 'We are looping now!');
                        break;
                    case 'loopone':
                        serverQueue.loopState = Music.LoopState.LoopOne;
                        Utils.shortEmbedReply(message, 'We are looping current song!');
                        break;
                    case 'loopnone':
                        serverQueue.loopState = Music.LoopState.LoopNone;
                        Utils.shortEmbedReply(message, 'We are not looping anymore.');
                        break;
                    case `help`:
                        this.commandList(message);
                        break;
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
                    case 'spotify':
                        this.music.spotifyPlayList(message);
                        break;
                    case 'guess':
                        this.predictSentiment(message, messageNoPrefix.split('guess').join(''));
                        break;
                    case 'lyrics':
                        this.music.findLyrics(message, serverQueue);
                        break;
                    default:
                        this.commandList(message);
                }
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
            .addField('Music 🎵', '!oz play [tytuł lub url] \n  !oz play [@nick kogoś] [tytuł lub url] \n !oz playlist [url] \n !oz skip  \n !oz skipto [index] \n !oz pause \n !oz resume  \n !oz clear  \n !oz queue  \n !oz delete [index] \n !oz lyrics \n !oz loop \n !oz loopone \n !oz loopnone' , true)
            .setColor(0xa62019)
            .addField('Inne 🥓', '!oz  \n !oz boczek [coś] 🥓 \n !oz guess [coś] \n !oz instrukcja \n !oz random \n !oz random [@nick] \n !oz help \n', true);

        return message.channel.send(reply);
    }
};