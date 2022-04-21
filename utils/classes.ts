import Discord from 'discord.js';

type RobloxRequestType = "Ban" | "Unban" | "Announce" | "CheckUser" | "Eval" | "Shutdown" | "GetJobID" | "GetJobIDs" | "Lock" | "Unlock" | "Mute" | "Unmute" | "";

export interface BotConfig {
    token: string,
    cookie: string
    projectId: string,
    clientEmail: string,
    privateKey: string,
    groupId: number,
    permissions: {
        group: {
            all: string[],
            shout: string[],
            ranking: string[],
            joinrequests: string[],
            exile: string[],
            audits: string[]
        },
        game: {
            all: string[],
            broadcast: string[],
            kick: string[],
            ban: string[],
            datastore: string[],
            execution: string[]
        }
    },
    logging: {
        enabled: boolean,
        auditLogChannel: string,
        shouttLogChannel: string,
        commandLogChannel: string
    }
    embedColors: {
        info: Discord.ColorResolvable,
        success: Discord.ColorResolvable,
        error: Discord.ColorResolvable
    }
    whitelistedServers: string[]
}

export interface RobloxRequest {
    authorID: string,
    channelID: string,
    type: RobloxRequestType,
    payload: any
}

export class BotClient extends Discord.Client {
    public config: BotConfig
    public embedMaker(title: string, description: string, type: "info" | "success" | "error", author? : Discord.User, makeObject?: boolean, ): any {
        if(!author) author = this.user;
        if(!makeObject) makeObject = true;
        let embed = new Discord.MessageEmbed();
        embed.setColor(this.config.embedColors[type]);
        embed.setAuthor({name: author.tag, iconURL: author.displayAvatarURL()});
        embed.setTitle(title);
        embed.setDescription(description);
        embed.setFooter({text: "Created by zachariapopcorn#8105 - https://discord.gg/XGGpf3q"});
        if(makeObject) {
            return {
                embeds: [embed],
                components: []
            }
        }
        return embed;
    }
}

export class CommandHelpers {
    public static loadArguments(interaction: Discord.CommandInteraction): any[] {
        let options = interaction.options.data;
        let args = [];
        for(let i = 0; i < options.length; i++) {
            args.push({
                [options[i].name]: options[i].value
            });
        }
        return args;
    }
    public static checkPermissions(command: any, user: Discord.GuildMember): boolean {
        let roleIDsRequired = command.commandData.permissions as string[];
        if(user.roles.cache.some(role => roleIDsRequired.includes(role.id))) return true;
        return false;
    }
}