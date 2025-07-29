import type { AnyTextableChannel, Message } from "oceanic.js";
import { ApplicationCommandTypes, InteractionTypes, MessageFlags } from "oceanic.js";

import { client, inCachedChannel } from "../client.ts";
import { bangInputs, bangRegex, bangs, allComponentHandlers } from "../globals.ts";
import { bangsByTitle, canUseBang, formatAndAddLinkButton, getBangExamples } from "../utils/bangs.ts";
import type { Context } from "../types.js";

const errorMsg = "Couldn't find that bang or no bang specified";
const bangAtStartRegex = /^!([\w-]+)\s?(.*)/si;
function matchBang(content: string): RegExpMatchArray | null {
    let matchOutput = content.match(bangRegex);
    if (!matchOutput) {
        // ugly but im lazy
        matchOutput = content.match(bangAtStartRegex);
        if (!matchOutput) return;
        [matchOutput[1], matchOutput[2]] = [matchOutput[2], matchOutput[1]];
    }
    return matchOutput;
}

client.on("interactionCreate", async ctx => {
    if (ctx.type === InteractionTypes.APPLICATION_COMMAND
        && ctx.data.type === ApplicationCommandTypes.CHAT_INPUT
        && ctx.data.name === "bang") {
        const content = ctx.data.options.getString("content", true);
        const ephemeral = ctx.data.options.getBoolean("ephemeral");
        const matchOutput = matchBang(content);
        if (!matchOutput)
            return ctx.reply({ content: errorMsg, flags: MessageFlags.EPHEMERAL });

        const input = bangInputs[ctx.user.id];
        const context = input?.message || Object.assign(ctx, { author: ctx.user }) satisfies Context;
        const attachments = input ? input.message.attachments.toArray() : [];

        if (matchOutput) {
            const [, origContent, bangUsed] = matchOutput;
            const [bangName, ...parameters] = bangUsed.split("-");
            if (parameters.length > 1)
                return ctx.reply({ content: errorMsg, flags: MessageFlags.EPHEMERAL });

            const parameter = parameters[0];
            let content = origContent ?? "";
            if (input)
                content = (input.message.content + "\n\n" + content).trim();

            const bang = bangs[bangName];
            if (!bang)
                return ctx.reply({ content: errorMsg, flags: MessageFlags.EPHEMERAL });
            else if (!canUseBang(bang.names[0], ctx.user, ctx.guildPartial))
                return ctx.reply({ content: errorMsg, flags: MessageFlags.EPHEMERAL });
            else if (!content && bang.ignoreIfBlank)
                return ctx.reply({ content: "That bang requires some input", flags: MessageFlags.EPHEMERAL });
            else {
                if (!bang.shortExecute)
                    // tri-state
                    ctx.defer(ephemeral === true ? MessageFlags.EPHEMERAL : 0);

                bang.execute(content, attachments, context, parameter).then(output => {
                    if (!output?.content)
                        return ctx.reply({ content: "Got no response, this is probably a bug", flags: MessageFlags.EPHEMERAL });
                    const response = output.content, { link } = output;
                    let flags = typeof response === "string" ? 0 : response.flags;
                    if (ephemeral) flags |= MessageFlags.EPHEMERAL;

                    ctx.reply({
                        ...formatAndAddLinkButton(response, bang.title, link),
                        flags
                    }).then(res => {
                        if (output.afterSend) res.getMessage().then(output.afterSend);
                    });

                    delete bangInputs[ctx.user.id];
                }).catch(e => { if (!process.env.SUPPRESS_WARNINGS) console.log(e); });
            }
        }
    } else if (ctx.type === InteractionTypes.APPLICATION_COMMAND
        && ctx.isMessageCommand()
        && ctx.data.name === "Use as bang input"
        && inCachedChannel(ctx)) {
        bangInputs[ctx.user.id] = {
            message: ctx.data.target as Message<AnyTextableChannel>,
            at: Date.now()
        };

        ctx.reply({
            content: "👍",
            flags: MessageFlags.EPHEMERAL
        });

    } else if (ctx.type === InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE
        && ctx.data.type === ApplicationCommandTypes.CHAT_INPUT
        && ctx.data.name === "bang") {
        let content = ctx.data.options.getString("content");
        if (!content) return ctx.result(getBangExamples());

        const validBang = matchBang(content);
        const bangsArray = Object.entries(bangsByTitle());

        if (validBang) {
            const [, bangContent, bangName] = validBang;
            const bangList = [] as ([string, string[]])[];
            content = bangContent ?? "";
            let hasExactMatch = false;

            for (const [title, aliases] of bangsArray) {
                if (!canUseBang(aliases[0], ctx.user, ctx.guildPartial)) continue;

                const filteredAliases = aliases.filter(a => a.startsWith(bangName));
                if (filteredAliases.length > 0) {
                    bangList.push([title, filteredAliases.sort(v => {
                        if (v === bangName) {
                            hasExactMatch = true;
                            return -1;
                        } else return 1;
                    })]);
                }
            }

            if (bangList.length === 1 || hasExactMatch) {
                const [title, aliases] = bangList[0];
                const bang = bangs[aliases[0]];
                if (bang.takesParameters && bang.paramSuggestions) {
                    let i = 1;
                    for (const [param, suggestion] of Object.entries(bang.paramSuggestions)) {
                        const paramAliases = aliases.map(alias => `${alias}-${param}`);
                        bangList.splice(i++, 0, [`${title}, ${suggestion}`, paramAliases]);
                    }
                }
            }

            const res = bangList.slice(0, 8).map(([title, aliases]) => {
                const queryPart = content ? `${content} ` : "";
                return {
                    name: `${queryPart}!${aliases[0]} (${title})`,
                    value: `${queryPart}!${aliases[0]}`
                };
            });

            return ctx.result(res);

        } else {
            const entries = bangsArray.filter(([, a]) =>
                canUseBang(a[0], ctx.user, ctx.guildPartial)
            );

            const choices = [] as ({ name: string; value: string })[];
            const words = content.trim().split(/\s+/);
            const potentialBang = words.pop() ?? "";
            const partialQuery = words.join(" ");

            let potentialMatches = [] as ([string, string[]])[];
            if (potentialBang) {
                potentialMatches = entries.filter(([, aliases]) =>
                    aliases.some(a => a.startsWith(potentialBang))
                );
            }
            if (potentialMatches.length > 0) {
                choices.push(
                    ...potentialMatches.map(([title, aliases]) => {
                        const queryPart = partialQuery ? `${partialQuery} ` : "";
                        return {
                            name: `${queryPart}!${aliases[0]} (${title})`,
                            value: `${queryPart}!${aliases[0]}`
                        };
                    })
                );
            }

            for (let i = entries.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [entries[i], entries[j]] = [entries[j], entries[i]];
            }
            choices.push(
                ...entries.map(([title, aliases]) => {
                    const queryPart = content ? `${content} ` : "";
                    return {
                        name: `${queryPart}!${aliases[0]} (${title})`,
                        value: `${queryPart}!${aliases[0]}`
                    };
                })
            );

            return ctx.result(choices.slice(0, 8));

        }
    } else if (ctx.type === InteractionTypes.MESSAGE_COMPONENT) {
        allComponentHandlers.forEach(handler => {
            if (handler.match.test(ctx.data.customID))
                return handler.handle(ctx);
        });
    }
});
