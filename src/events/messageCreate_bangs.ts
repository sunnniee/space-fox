import { inspect } from "util";
import { ComponentTypes, MessageFlags } from "oceanic.js";
import type { AnyTextableChannel, Message } from "oceanic.js";

import { client, inCachedChannel } from "../client.ts";
import { bangInputs, bangRegex, bangs } from "../globals.ts";
import { formatAndAddLinkButton, canUseBang } from "../utils/bangs.ts";
import type { Context } from "../types.ts";

function handleError(msg: Message, e: any, flags?: number) {
    if (!process.env.SUPPRESS_WARNINGS) console.log(inspect(e, { depth: 7, colors: true }));
    if (flags && (flags & MessageFlags.IS_COMPONENTS_V2))
        client.respond(msg, {
            components: [{
                type: ComponentTypes.TEXT_DISPLAY,
                content: "Something went wrong while running that, oop"
            }],
            flags
        }).catch(() => { });
    else
        client.respond(msg, {
            content: "Something went wrong while running that, oop"
        }).catch(() => { });
}

client.on("messageCreate", async msg => {
    if (msg.author.bot) return;
    if (!inCachedChannel(msg)) return;
    const matchOutput = msg.content.match(bangRegex);
    if (matchOutput) {
        const [_, origContent, bangUsed] = matchOutput;
        const [bangName, ...parameters] = bangUsed!.split("-");
        if (parameters.length > 1) return;

        const parameter = parameters[0];
        let content = origContent ?? "";
        const attachments = msg.attachments.toArray();
        const input = bangInputs[msg.author.id];

        if (input) {
            content = (input.message.content + "\n\n" + content).trim();
            attachments.push(...input.message.attachments.toArray() || []);
        } else if (msg.referencedMessage) {
            content = (msg.referencedMessage.content + "\n\n" + content).trim();
            attachments.push(...msg.referencedMessage.attachments.toArray() || []);
        }

        const ctx = (input?.message || msg.referencedMessage || msg) as Message<AnyTextableChannel>;
        if (!ctx.guild) Object.defineProperty(ctx, "guild", { value: msg.guild });

        const bang = bangs[bangName!];
        if (!bang) return;
        else if (!canUseBang(bang.names[0], msg.author, msg.guild)) return;
        else if (!content && !attachments.length && bang.ignoreIfBlank) return;
        else if (parameter && !bang.takesParameters) return;
        else {
            if (!bang.shortExecute) client.sendTyping(msg.channelID);

            bang.execute(content, attachments,
                Object.assign(ctx, { editSelf: ctx.edit }) satisfies Context,
                parameter).then(output => {
                if (!output || !output.content) return;
                const response = output.content, { link } = output;
                const msgContent = formatAndAddLinkButton(response, bang.title, link);
                client.respond(msg, msgContent)
                    .then(msg => {
                        if (msg && output.afterSend) output.afterSend(msg);
                    })
                    .catch(e => handleError(msg, e, msgContent.flags));

                delete bangInputs[msg.author.id];
            }).catch(e => handleError(msg, e));
        }
    }
});
