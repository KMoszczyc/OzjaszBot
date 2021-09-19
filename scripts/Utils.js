const Discord = require('discord.js');
const fs = require('fs');

module.exports = class Utils {
    static getUserId(userRef) {
        return userRef.slice(3, userRef.length - 1);
    }

    static getUserVoiceChannel(message, userId) {
        return message.guild.member(userId).voice.channel;
    }

    static roundToTwo(num) {
        return +(Math.round(num + 'e+2') + 'e-2');
    }

    static async sendEmbeds(title, text, message) {
        const message_embed = new Discord.MessageEmbed()
            .setColor(0xa62019)
            .setTitle(title);
        let prevIndex = 0;
        for (let i = 500; i < text.length; i += 500) {
            const index = text
                .substring(i, Math.min(text.length, i + 500))
                .indexOf('\n');
            console.log(i, index);
            const toSend = text.substring(prevIndex, index + i);
            prevIndex = index + i;

            message_embed.addField('\u200B', toSend);
        }
        message.channel.send(message_embed);
    }

    static createSpaces(number) {
        return Array(number).fill('\xa0').join('');
    }

    static secondsToTime(seconds) {
        let timeStr = new Date(seconds * 1000).toISOString().substr(11, 8);
        if (seconds < 3600) 
            timeStr = timeStr.substring(3, timeStr.length);

        if (seconds < 600) 
            timeStr = timeStr.substring(1, timeStr.length);

        return timeStr;
    }

    static async shortEmbedReply(textChannel, reply) {
        textChannel.send(new Discord.MessageEmbed().setDescription(reply).setColor(0xa62019));
    }

    static async readFile(path) {
        return new Promise((resolve, reject) => {
            fs.readFile(path, 'utf8', function (err, data) {
                if (err) {
                    reject(err);
                }
                resolve(data);
            });
        });
    }

    static async getRandomLine(filename) {
        let data = await Utils.readFile(filename);
        data += '';
        const lines = data.split('\n');
        return lines[Math.floor(Math.random() * lines.length)];
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static convertIsoTime(isoTime) {
        let convertedTime = '';
        isoTime = isoTime.substring(2);

        const hourIndex = isoTime.indexOf('H');
        const minIndex = isoTime.indexOf('M');
        const secIndex = isoTime.indexOf('S');
        if (hourIndex !== -1)
            convertedTime += isoTime.substring(0, hourIndex);

        if (minIndex !== -1) {
            if (hourIndex !== -1)
                convertedTime += ':';
            convertedTime += isoTime.substring(hourIndex + 1, minIndex) + ':';
        }

        if (secIndex !== -1) {
            const secondText = isoTime.substring(minIndex + 1, isoTime.length - 1);
            const secondInt = parseInt(secondText, 10);
            if (secondInt < 10)
                convertedTime += '0';
            convertedTime += secondText;
        } else
            convertedTime += '00';

        return convertedTime;
    }

    static checkPermissions(message, voiceChannel) {
        if (!voiceChannel)
            return message.channel.send('You need to be in a voice channel!');
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
            return message.channel.send('I need the permissions to join and speak in your voice channel!');
        }
    }

    static shuffleArray(array) {
        // dont shuffle first song
        for (let i = array.length - 1; i > 1; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    static parseHour(hour){
        let hourInt = parseInt(hour);
        if(isNaN(hourInt) || hourInt<0 || hourInt>23)
            throw new Error('Wrong hour!')
        return hourInt
    }

    static parseMinute(minute){
        let minuteInt = parseInt(minute);
        if(isNaN(minuteInt) || minuteInt<0 || minuteInt>60)
            throw new Error('Wrong minute!')
        return minuteInt
    }

    static beautyNum(num){
        return num.toString().padStart(2, '0') // "09"
    }

    static beautyTime(hour, minute){
        return `${hour}:${Utils.beautyNum(minute)}`
    }
};
