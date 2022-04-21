import Discord from 'discord.js';
import roblox from 'noblox.js'

import fs from 'fs/promises';

import { config } from './config'

import * as globals from './utils/globalVariables'

import express from 'express';

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { BotClient, CommandHelpers } from './utils/classes';

const client = new Discord.Client({intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES]}) as BotClient;
client.config = config;
const app = express();

const token = config.token;
const cookie = config.cookie;

export const commands = [];
export const interactions = [];

app.get('/', async (request, response) => {
    response.sendStatus(200);
});

app.get('/get', async (request, response) => {
    response.status(200).send(globals.request);
});

app.post('/process', async (request, response) => {
    response.status(200);
});

app.listen(process.env.PORT, () => {
    console.log(`Your app is currently listening on port: ${process.env.PORT}`);
});

async function readCommands(path?: string) {
    if(!path) path = "./commands";
    let files = await fs.readdir(path);
    for(let i = 0; i < files.length; i++) {
        let file = files[i];
        if(file.indexOf(".") === -1) {
            readCommands(`${path}/${file}`);
        } else {
            file = file.replace(".ts", ".js");
            let commandFile = require(`${path}/${file}`);
            let command = {
                file: commandFile,
                name: file.split('.')[0],
                slashData: commandFile.slashData,
                commandData: commandFile.commandData || []
            }
            commands.push(command);
        }
    }
}

async function readInteractions() {
    let files = await fs.readdir(`./interactions/`);
    for(var i = 0; i < files.length; i++) {
        let file = files[i];
        file = file.replace(".ts", ".js");
        let coreFile = require(`./interactions/${file}`);
        interactions.push({
            file: coreFile,
            name: file.split('.')[0],
        });
    }
}

async function registerSlashCommands() {
    let slashCommands = [];
    for(let i = 0; i < commands.length; i++) {
        let commandData;
        try {
            commandData = await commands[i].slashData.toJSON();
            slashCommands.push(commandData);
        } catch(e) {
            console.log(`Couldn't load slash command data for ${commands[i].name} with error: ${e}`);
        }
    }
    let rest = new REST({version: "9"}).setToken(token);
    try {
        for(let i = 0; i < config.whitelistedServers.length; i++) {
            let serverID = config.whitelistedServers[i];
            await rest.put(Routes.applicationGuildCommands(client.user.id, serverID),{body: slashCommands});
        }
    } catch(e) {
        console.error(`There was an error while registering slash commands: ${e}`);
    }
}

async function loginToRoblox() {
    try {
        await roblox.setCookie(cookie);
    } catch {
        console.log("Unable to login to Roblox");
        return;
    }
    let auditLogListener = roblox.onAuditLog(config.groupId);
    auditLogListener.on('data', async(data) => {
        if(config.logging.enabled === false) return;
        let embedDescription = "";
        embedDescription += `**Actor**: ${data.actor}\n`;
        embedDescription += `**Action**: ${data.actionType}\n`;
        embedDescription += `**Date**: ${data.created}\n`;
        let embed = client.embedMaker("New Audit Log", embedDescription, "info");
        let channel = await client.channels.fetch(config.logging.auditLogChannel) as Discord.TextChannel;
        if(!channel) return;
        try {
            await channel.send(embed);
        } catch(e) {
            console.error(`There was an error while trying to send the audit data to the Discord logging channel: ${e}`);
        }
    });
    auditLogListener.on('error', async(e) => {
        console.error(`There was an error while trying to fetch the audit data: ${e.message}`);
    });
    let shoutListener = roblox.onShout(config.groupId);
    shoutListener.on('data', async(data) => {
        if(config.logging.enabled === false) return;
        if(data.poster.username === (await roblox.getCurrentUser()).UserName) return;
        let embedDescription = "";
        embedDescription += `**Poster**: ${data.poster.username}\n`;
        embedDescription += `**Body**: ${data.body}\n`;
        embedDescription += `**Created**: ${data.created}\n`;
        let embed = client.embedMaker("New Shout", embedDescription, "info");
        let channel = await client.channels.fetch(config.logging.shouttLogChannel) as Discord.TextChannel;
        if(!channel) return;
        try {
            await channel.send(embed);
        } catch(e) {
            console.error(`There was an error while trying to send the shout data to the Discord logging channel: ${e}`);
        }
    });
    shoutListener.on('error', async(e) => {
        console.error(`There was an error while trying to fetch the shout data: ${e.message}`);
    });
}

client.on('ready', async() => {
    console.log(`Logged into the Discord account - ${client.user.tag}`);
    await loginToRoblox();
    await readCommands();
    await readInteractions();
    await registerSlashCommands();
});

client.on('interactionCreate', async(interaction) => {
    if(!interaction.isCommand()) return;
    let command = interaction.commandName.toLowerCase();
    for(let i = 0; i < commands.length; i++) {
        if(commands[i].name === command) {
            await interaction.deferReply();
            let args = CommandHelpers.loadArguments(interaction);
            if(!CommandHelpers.checkPermissions(commands[i], interaction.member as Discord.GuildMember)) {
                let embed = client.embedMaker("No Permission", "You don't have permission to run this command", "error", interaction.user);
                await interaction.editReply(embed);
            }
            try {
                await commands[i].file.run(interaction, client, args);
            } catch(e) {
                let embed = client.embedMaker("Error", "There was an error while trying to run this command. The error has been logged in the console", "error", interaction.user);
                await interaction.editReply(embed);
            }
        }
    }
});

client.login(token);