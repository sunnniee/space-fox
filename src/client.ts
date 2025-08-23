import { config } from "dotenv";
import { Client as _Client } from "oceanic.js";
import type { AnyInteractionChannel, AnyTextableChannel, AnyTextableGuildChannel, ApplicationCommandTypes, ClientEvents, CommandInteraction, CreateMessageOptions, Message, Uncached } from "oceanic.js";
config();

interface Client extends _Client<ClientEvents> {
    sendMessage: (channelID: string, content: CreateMessageOptions | string, tryAgain?: boolean)
    => Promise<void | Message<AnyTextableGuildChannel>>;
    editMessage: (message: Message, content: CreateMessageOptions | string, tryAgain?: boolean)
    => Promise<void | Message<AnyTextableGuildChannel>>;
    deleteMessage: (message: Message, tryAgain?: boolean) => Promise<void | unknown>;
    respond: (message: Message, content: CreateMessageOptions | string)
    => Promise<void | Message<AnyTextableGuildChannel>>;
    sendTyping: (channelID: string) => Promise<void>;
}

export const client = new _Client({
    auth: `Bot ${process.env.DISCORD_TOKEN}`,
    gateway: {
        intents: ["GUILDS", "GUILD_MESSAGES", "DIRECT_MESSAGES", "MESSAGE_CONTENT"]
    },
    allowedMentions: { everyone: false, roles: false, users: false, repliedUser: false }
}) as Client;

const log = e => { if (!process.env.SUPPRESS_WARNINGS) console.log(e); };

client.sendMessage = (channelID, content, tryAgain = true) =>
    client.rest.channels
        .createMessage<AnyTextableGuildChannel>(channelID, typeof content === "string" ? { content } : content)
        .catch(e => tryAgain ? client.sendMessage(channelID, content, false) : log(e));

client.editMessage = (message, content, tryAgain = true) =>
    message && client.rest.channels
        .editMessage<AnyTextableGuildChannel>(message.channelID, message.id, typeof content === "string" ? { content } : content)
        .catch(e => tryAgain ? client.editMessage(message, content, false) : log(e));

client.deleteMessage = (message: Message, tryAgain = true) =>
    message && client.rest.channels
        .deleteMessage(message.channel!.id, message.id)
        .catch(() => tryAgain && client.deleteMessage(message, false));

client.respond = (msg: Message, c: CreateMessageOptions | string) => {
    let content: CreateMessageOptions = { messageReference: { messageID: msg.id, channelID: msg.channel!.id } };
    if (typeof c === "string") content.content = c;
    else content = { ...content, ...c };
    return client.sendMessage(msg.channelID, content);
};

client.sendTyping = (channelID: string) =>
    client.getChannel<AnyTextableGuildChannel>(channelID)!.sendTyping().catch(() => { });

export function inCachedChannel(ctx: Message<AnyTextableChannel | Uncached>): ctx is Message<AnyTextableChannel>;
export function inCachedChannel<C extends ApplicationCommandTypes>(
    ctx: CommandInteraction<AnyInteractionChannel | Uncached, C>
): ctx is CommandInteraction<AnyInteractionChannel, C>;
export function inCachedChannel(
    ctx: Message<AnyTextableChannel | Uncached> | CommandInteraction<AnyInteractionChannel | Uncached>
): boolean {
    return ctx.inCachedGuildChannel() || client.privateChannels.has(ctx.channelID);
}
