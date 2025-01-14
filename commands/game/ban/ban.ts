import Discord from 'discord.js';
import * as Builders from '@discordjs/builders';
import { BotClient, CommandData, CommandLog, MessagingService, ModerationData, RobloxDatastore } from '../../../utils/classes';
import { config } from '../../../config';

import roblox = require('noblox.js');

export async function run(interaction: Discord.CommandInteraction, client: BotClient, args: any) {
    let database = new RobloxDatastore(client.config.ROBLOX_API_KEY);
    let messaging = new MessagingService(client.config.ROBLOX_API_KEY);
    let logs: CommandLog[] = [];
    let usernames = args["username"].replaceAll(" ", "").split(",");
    let reasons = args["reason"];
    if(!reasons) { // If nothing for the reason argument was inputted
        reasons = [];
        while(true) {
            if(reasons.length === usernames.length) break;
            reasons.push("No reason provided");
        }
    } else {
        reasons = reasons.split(",");
        if(reasons.length === 1) {
            while(true) {
                if(reasons.length === usernames.length) break;
                reasons.push(reasons[0]);
            }
        } else if(reasons.length !== usernames.length) {
            let embed = client.embedMaker("Argument Error", `You inputted an unequal amount of usernames and reasons, please make sure that these amounts are equal, or, if you wish to apply one reason to multiple people, only put that reason for the reason argument`, "error", interaction.user);
            return await interaction.editReply(embed);
        }
    }
    for(let i = 0; i < usernames.length; i++) {
        let username = usernames[i];
        let reason = reasons[i];
        let robloxID;
        try {
            robloxID = await roblox.getIdFromUsername(username);
        } catch {
            logs.push({
                username: username,
                status: "Error",
                message: "The username provided is an invalid Roblox username"
            });
            continue;
        }
        username = await roblox.getUsernameFromId(robloxID);
        try {
            let oldData: ModerationData;
            try {
                oldData = await database.getModerationData(robloxID);
            } catch(e) {
                if(!(e.response.data.error === "NOT_FOUND")) {
                    logs.push({
                        username: username,
                        status: "Error",
                        message: e
                    });
                    continue;
                } else {
                    oldData = {
                        banData: { // Gets overridden in the setModerationData call
                            isBanned: false,
                            reason: ""
                        },
                        muteData: {
                            isMuted: false,
                            reason: ""
                        }
                    }
                }
            }
            await database.setModerationData(robloxID, {banData: {isBanned: true, reason: reason}, muteData: {isMuted: oldData.muteData.isMuted, reason: oldData.muteData.reason}});
        } catch(e) {
            console.log(e.response.data);
            logs.push({
                username: username,
                status: "Error",
                message: e
            });
            continue;
        }
        let didKickError = false;
        try {
            await messaging.sendMessage("Kick", {username: username});
        } catch(e) {
            console.log(e.response.data);
            didKickError = true;
            logs.push({
                username: username,
                status: "Error",
                message: `Although this user is now banned, I couldn't kick them from the game because of the following error: ${e}`
            });
        }
        if(!didKickError) {
            logs.push({
                username: username,
                status: "Success"
            });
        }
        await client.logAction(`<@${interaction.user.id}> has banned **${username}** from the game with the reason of **${reason}**`);
        continue;
    }
    await client.initiateLogEmbedSystem(interaction, logs);
}

export const slashData = new Builders.SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bans the inputted user(s) from the game")
    .addStringOption(o => o.setName("username").setDescription("The username(s) of the user(s) you wish to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("The reason(s) of the ban(s)").setRequired(false))

export const commandData: CommandData = {
    category: "Ban",
    permissions: config.permissions.game.ban
}