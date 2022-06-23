require("dotenv").config();

// APIs
const Discord = require("discord.js");
const axios = require("axios");
const translate = require("translation-google");
const schedule = require("node-schedule");

// project imports
const Utils = require("./Utils");
const Music = require("./Music");

console.log("beep beep! ");
const brzechwa_url = "https://www.youtube.com/watch?v=32ixE73t_uA&t=1431s";

module.exports = class DiscordBot {
    constructor() {
        this.client = new Discord.Client();
        this.music = new Music.Music(this.client);
        this.prefix = "-";
        this.scheduledJobs = new Map();

        this.client.login(process.env.TOKEN);
        this.client.on("ready", this.readyDiscord.bind(this));
        this.client.on("message", this.gotMessage.bind(this));
        this.client.on("voiceStateUpdate", (oldMember, newMember) => this.voiceStateUpdate(oldMember, newMember));
    }

    readyDiscord() {
        console.log("its ready already!");
        this.client.user.setActivity(`${this.prefix}help`, {
            type: "PLAYING",
        });
        this.music.setupSpotify();
    }

    async voiceStateUpdate(oldMember, newMember) {
        const oldVoice = oldMember.channelID;
        const newVoice = newMember.channelID;

        if (oldVoice !== newVoice && oldVoice === null && newMember.id === this.client.user.id) {
            console.log("Ozjasz bot joined!");
            const serverQueue = this.music.queue.get(newMember.guild.id);
            if (serverQueue && serverQueue.songs.length !== 0 && serverQueue.connection !== null) {
                this.music.connectBot(newMember.guild.id, newMember.channel, serverQueue).then((conn) => {
                    if (conn) this.music.play(newMember.guild, serverQueue.songs[0]);
                });
            }
        }
    }

    async gotMessage(message) {
        console.log(message.content);
        const serverQueue = this.music.queue.get(message.guild.id);

        if (message.content.substring(0, 3) === "!oz")
            Utils.shortEmbedReply(message.channel, `!oz is gone, now ${this.prefix} is the new command`);

        if (message.content[0] === this.prefix) {
            const messageNoPrefix = message.content.substring(this.prefix.length);
            const messageSplit = messageNoPrefix.split(" ");

            console.log(messageSplit);
            switch (messageSplit[0]) {
                case "p":
                case `play`:
                    this.music.playCommand(message, messageSplit, messageNoPrefix, serverQueue);
                    break;
                case "pt":
                case "playtop":
                    this.music.playAtTopCommand(message, messageSplit, messageNoPrefix, serverQueue);
                    break;
                case "s":
                case `skip`:
                    this.music.skipCommand(message, serverQueue);
                    break;
                case `skipto`:
                    this.music.skipToCommand(message, messageSplit, serverQueue);
                    break;
                case "shuffle":
                    Utils.shuffleArray(serverQueue.songs);
                    this.music.play(message.guild, serverQueue.songs[serverQueue.currentSongIndex]);
                    break;
                case "pause":
                    this.music.pause(message, serverQueue);
                    break;
                case "resume":
                    this.music.resume(message, serverQueue);
                    break;
                case "c":
                case `clear`:
                    this.music.clearQueueCommand(message, serverQueue);
                    break;
                case "q":
                case `queue`:
                    this.music.showQueueCommand(message, serverQueue);
                    break;
                case "d":
                case "delete":
                    this.music.deleteSongCommand(message, messageSplit, serverQueue);
                    break;
                case "l":
                case "loop":
                    serverQueue.loopState = Music.LoopState.LoopAll;
                    Utils.shortEmbedReply(message.channel, "We are looping now!");
                    break;
                case "loopone":
                    serverQueue.loopState = Music.LoopState.LoopOne;
                    Utils.shortEmbedReply(message.channel, "We are looping current song!");
                    break;
                case "lo":
                case "loopoff":
                    serverQueue.loopState = Music.LoopState.LoopOff;
                    Utils.shortEmbedReply(message.channel, "We are not looping anymore.");
                    break;
                case "h":
                case `help`:
                    this.commandList(message);
                    break;
                case "b":
                case "boczek":
                    Utils.getRandomLine("./data/boczek-epitety.txt").then((sentence) => {
                        message.channel.send(messageNoPrefix.split("boczek ").join("") + " to " + sentence);
                    });
                    break;
                case "tvp":
                    this.getRandomTVPHeadline(message, messageNoPrefix);
                    break;
                case "instrukcja":
                    Utils.getRandomLine("./data/instrukcja-lol.txt").then((sentence) => {
                        message.channel.send(sentence);
                    });
                    break;
                case "random":
                    if (messageSplit.length === 3) {
                        const voiceChannel = Utils.getUserVoiceChannel(message, Utils.getUserId(messageSplit[2]));
                        this.music.playAtTop(message.guild, message.channel, voiceChannel, this.music.getRandomOzjasz(), serverQueue);
                    } else
                        this.music.playAtTop(
                            message.guild,
                            message.channel,
                            message.member.voice.channel,
                            this.music.getRandomOzjasz(),
                            serverQueue
                        );
                    break;
                case "brzechwa":
                    if (messageSplit.length === 3) {
                        const voiceChannel = Utils.getUserVoiceChannel(message, Utils.getUserId(messageSplit[2]));
                        this.music.playAtTop(message.guild, message.channel, voiceChannel, brzechwa_url, serverQueue, 23 * 60 + 50);
                    } else
                        this.music.playAtTop(
                            message.guild,
                            message.channel,
                            message.member.voice.channel,
                            brzechwa_url,
                            serverQueue,
                            23 * 60 + 50
                        );
                    break;
                case "join":
                    message.member.voice.channel.join();
                    this.music.createQueue(message, message.member.voice.channel, null);
                    break;
                case "guess":
                    this.predictSentiment(message, messageNoPrefix.split("guess").join(""));
                    break;
                case "ly":
                case "lyrics":
                    this.music.findLyrics(message, serverQueue);
                    break;
                case "o":
                case "ozjasz":
                    Utils.getRandomLine("./data/ozjasz-wypowiedzi.txt").then((sentence) => {
                        message.channel.send(sentence);
                    });
                    break;
                case "schedule":
                    this.addScheduleCommand(message);
                    break;
                case "delete_schedule":
                    this.deleteScheduleCommand(message);
                    break;
                case "schedules":
                    this.showSchedules(message);
                    break;
                case "tusk":
                    this.music.playAtTop(
                        message.guild,
                        message.channel,
                        message.member.voice.channel,
                        this.music.randomTusk(),
                        serverQueue
                    );
                    break;
                default:
                    this.commandList(message);
            }
        }
    }

    async predictSentiment(message, sentence) {
        try {
            const englishSentence = await translate(sentence, {
                from: "pl",
                to: "en",
            });
            console.log(englishSentence.text);

            const results = await axios.post("https://sentiment-prediction-deepl.herokuapp.com/predict", {
                text: englishSentence.text,
            });
            console.log(results.data[0]);
            let response = results.data[0].prediction === 0 ? "negative" : "positive";
            response += " - " + Math.floor(results.data[0].probability * 100) + "%";

            message.channel.send(response);
        } catch (e) {
            console.log(e);
        }
    }

    async commandList(message) {
        const reply = new Discord.MessageEmbed()
            .setAuthor("Oto komendy.. \n", this.client.user.avatarURL())
            .addField(
                "Music 🎵",
                `${this.prefix}play (${this.prefix}p) [tytuł lub url] \n  ${this.prefix}play [@nick kogoś] [tytuł lub url] \n ${this.prefix}playtop (${this.prefix}pt) [tytuł lub url] \n  ${this.prefix}playtop [@nick kogoś] [tytuł lub url] \n ${this.prefix}skip (${this.prefix}s)  \n ${this.prefix}skipto [index] \n ${this.prefix}pause \n ${this.prefix}resume  \n ${this.prefix}clear  \n ${this.prefix}queue (${this.prefix}q) \n ${this.prefix}delete [index] \n ${this.prefix}lyrics \n ${this.prefix}loop (${this.prefix}l) \n ${this.prefix}loopone \n ${this.prefix}loopoff (${this.prefix}lo) \n ${this.prefix}brzechwa \n ${this.prefix}schedule [nazwa godzina minuta url wiadomość] \n ${this.prefix}delete_schedule [nazwa] \n ${this.prefix}schedules`,
                true
            )
            .setColor(0xa62019)
            .addField(
                "Inne 🥓",
                `${this.prefix}ozjasz (${this.prefix}o)  \n ${this.prefix}boczek [coś] 🥓 \n ${this.prefix}guess [coś] \n ${this.prefix}instrukcja \n ${this.prefix}random \n ${this.prefix}random [@nick] \n ${this.prefix}tusk \n ${this.prefix}help \n`,
                true
            );

        return message.channel.send(reply);
    }

    scheduleSongOnAllServers(url, jobName, hour, minute) {
        this.client.guilds.cache.forEach((server) => {
            console.log(`${server.name} (id:${server.id})`);
            const infoMessage = `Jest ${Utils.beautyTime(hour, minute)} gramy ${jobName}`;
            this.scheduleFunctionToRunPeriodically(
                () => this.playSongAndSendMessage(server, url, infoMessage),
                server.id,
                jobName,
                hour,
                minute
            );
        });
    }

    playSongAndSendMessage(server, url, message) {
        let textChannel = this.sendMessageOnRandomChannel(server, message);
        console.log(textChannel);
        this.playSongOnMostPopularChannel(server, textChannel, url);
    }

    playSongOnMostPopularChannel(server, textChannel, url) {
        const voiceChannels = server.channels.cache.filter((c) => c.type == "voice");

        let maxSize = 0;
        let maxVoiceChannel = null;
        voiceChannels.forEach((channel) => {
            if (channel.id != server.afkChannelID && channel.members.size > maxSize) {
                maxSize = channel.members.size;
                maxVoiceChannel = channel;
            }
        });

        if (maxSize > 0) {
            console.log(`${maxVoiceChannel.name} ${maxVoiceChannel.members.size}`);
            this.music.playAtTop(server, textChannel, maxVoiceChannel, url, null, 5);
        }
    }

    sendMessageOnRandomChannel(server, message) {
        const textChannels = server.channels.cache.filter((c) => c.type == "text");
        for (const [key, channel] of textChannels.entries()) {
            let permissions = channel.permissionsFor(server.me);
            if (permissions.has("SEND_MESSAGES") && permissions.has("VIEW_CHANNEL")) {
                // console.log(textChannels[i])
                Utils.shortEmbedReply(channel, message);
                return channel;
            }
        }
    }

    async addScheduleCommand(message) {
        let messageSplit = message.content.split(" ");
        messageSplit.shift();
        if (messageSplit.length >= 4) {
            const [jobName, hour, minute, url, ...scheduledMessage] = messageSplit;
            console.log(scheduledMessage);
            this.scheduleFunctionToRunPeriodically(
                () => this.playSongAndSendMessage(message.guild, url, scheduledMessage.join(" ")),
                message.guild.id,
                jobName,
                Utils.parseHour(hour),
                Utils.parseMinute(minute)
            );
        }
    }

    createScheduledJobs(guildID) {
        this.scheduledJobs.set(guildID, new Map());
    }

    scheduleFunctionToRunPeriodically(fun, guildID, jobName, h, min) {
        const job = schedule.scheduleJob({ hour: h, minute: min }, () => {
            fun();
        });

        if (!this.scheduledJobs.has(guildID)) this.createScheduledJobs(guildID);

        this.scheduledJobs.get(guildID).set(jobName, { job: job, hour: h, minute: min });
        return job;
    }

    deleteScheduleCommand(message) {
        let messageSplit = message.content.split(" ");
        let jobID = messageSplit[1];
        let guildID = message.guild.id;

        if (!this.scheduledJobs.get(guildID).has(jobID)) Utils.shortEmbedReply(message.channel, "Nie ma takiego utworu!");
        else {
            this.scheduledJobs.get(guildID).get(jobID).job.cancel();
            this.scheduledJobs.get(guildID).delete(jobID);
        }
    }

    getRandomTVPHeadline(message, messageNoPrefix) {
        const text = messageNoPrefix.split(" ").slice(1).join(" ");
        if (text.length != "") {
            Utils.getRandomLineWithText("./data/paski-tvp.txt", text).then((sentence) => {
                console.log(sentence);
                message.channel.send(sentence);
            });
        } else {
            Utils.getRandomLine("./data/paski-tvp.txt").then((sentence) => {
                message.channel.send(sentence);
            });
        }
    }

    showSchedules(message) {
        if (!this.scheduledJobs.has(message.guild.id)) {
            Utils.shortEmbedReply(message.channel, "There is not any song scheduled!");
            return;
        }

        const schedules = Array.from(this.scheduledJobs.get(message.guild.id)).sort((a, b) => {
            return a[1].hour - b[1].hour + a[1].minute - b[1].minute;
        });

        console.log(schedules);

        let reply = `\`\`\`nim\n`;
        reply += `Cykliczny rozkład muzyczny: \n\n`;
        let i = 1;
        for (const [jobID, job] of schedules) {
            reply += `${i}.\t${jobID} - ${Utils.beautyTime(job.hour, job.minute)} \t\n`;
            i++;
        }
        reply += `\`\`\``;
        Utils.shortEmbedReply(message.channel, reply);
    }
};
