import { ComponentBuilder, EmbedBuilder } from "@oceanicjs/builders";

import { ButtonStyles, ComponentTypes, MessageFlags, SeparatorSpacingSize } from "oceanic.js";
import type { Message, MessageActionRow, MessageComponent, SeparatorComponent, TextDisplayComponent } from "oceanic.js";
import { client } from "../client.ts";
import { formatAndAddLinkButton, registerBang } from "../utils/bangs.ts";
import { purgeOldValues } from "../utils/purge.ts";
import { ComponentHandlerTypes } from "../types.ts";

type SearchResult = {
    documents: {
        mdn_url: string;
        title: string;
        slug: string;
        summary: string;
    }[];
};

let messageNr = 42; // too lazy to do a proper id system, not like revealing how many times this was used is disastrous
const messages: Record<string, {
    message: Message;
    at: number;
    buttons: {
        title: string;
        url: string;
    }[];
}> = {};

purgeOldValues(messages, 300_000, obj => {
    const msg = obj.message;
    if (msg) {
        client.editMessage(msg, {
            components: msg.components.map(c => {
                if (c.type !== ComponentTypes.CONTAINER) return c;
                return {
                    type: ComponentTypes.CONTAINER,
                    components: c.components.filter(r => r.type !== ComponentTypes.ACTION_ROW)
                };
            }),
            allowedMentions: { repliedUser: false } // not sure why it needs this
        });
    }
});

const parse = (segment: string, baseUrl: string) => segment
    .replace(/<a .*?href="(.+?)".*?>(.+?)<\/a>/gm, "[$2]($1)")
    .replace(/\[(.+?)\]\(\/(.+?)\)/gm, "[$1](https://developer.mozilla.org/$2)")
    .replace(/\[(.+?)\]\(#(.+?)\)/gm, `[$1](${baseUrl}#$2)`)
    .replace(/<div class="code-example">.{0,100}class="brush:\s(\w+).{0,50}<code>(.+?)\n<\/code>/gsi, "```$1\n$2```")
    .replace(/<code.*?>|<\/code>/gm, "``")
    .replace(/<b.*?>|<\/b>|<strong.*?>|<\/strong>/gm, "**")
    .replace(/<\/?\w.*?>/gi, "");

const bangTitle = "MDN Web Docs";
registerBang({
    title: bangTitle,
    names: ["mdn"],
    ignoreIfBlank: true,

    componentHandlers: [{
        match: /^mdn:/,
        type: ComponentHandlerTypes.BUTTON,
        handle: async ctx => {
            const [, id, messageNr, i] = ctx.data.customID.split(":");
            if (id !== ctx.user.id || !messages[messageNr]) return;
            const results = messages[messageNr].buttons;
            const { title, url } = results[i];

            const result = (await (await fetch(`https://developer.mozilla.org${url}`)).text())
                .replace(/<!--\/?lit-.+?-->/g, "").replace(/ +/g, " ");
            const match = result.match(/content-section"\s+>\s+<p>(?<summary>.+?)<\/p>.+?href="#try_it".{0,150}<\/interactive-example>(?<description>.+?)<\/pre><\/div>/si)
                ?? result.match(/content-section"\s+>\s+(?<summary>.+?)<\/p>.+?href="#description">.{0,50}<\/h2>(?<description>.+?)<\/section>/si)
                ?? result.match(/content-section"\s+>\s+(?<summary>.+?)<\/p>/si);
            if (!match) return ctx.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x1b1b1b)
                    .setDescription("Failed to parse the content of that page")
                    .toJSON()],
                components: new ComponentBuilder<MessageActionRow>()
                    .addURLButton({
                        label: `Open in ${bangTitle}`,
                        url: `https://developer.mozilla.org${url}`
                    })
                    .toJSON(),
                flags: MessageFlags.EPHEMERAL
            });

            delete messages[messageNr];
            const { groups } = match;
            return ctx.editParent(formatAndAddLinkButton({
                components: [{
                    type: ComponentTypes.CONTAINER,
                    components: [{
                        type: ComponentTypes.TEXT_DISPLAY,
                        content: `## ${title}`
                    } satisfies TextDisplayComponent,
                    {
                        type: ComponentTypes.SEPARATOR,
                        spacing: SeparatorSpacingSize.SMALL,
                        divider: true
                    } satisfies SeparatorComponent,
                    {
                        type: ComponentTypes.TEXT_DISPLAY,
                        content: parse(groups.summary, `https://developer.mozilla.org${url}`)
                    } satisfies TextDisplayComponent,
                    ]
                        .concat(groups.description ? [{
                            type: ComponentTypes.TEXT_DISPLAY,
                            content: parse(groups.description, `https://developer.mozilla.org${url}`)
                        } satisfies TextDisplayComponent] : [])
                }],
                flags: MessageFlags.IS_COMPONENTS_V2
            }, bangTitle, `https://developer.mozilla.org${url}`));
        }
    }],

    execute: async (content, _, ctx) => {
        const result = await (
            await fetch(`https://developer.mozilla.org/api/v1/search?q=${encodeURIComponent(content)}&locale=en-US`)
        ).json() as SearchResult;
        if (!("documents" in result) || !result.documents?.length) return {
            content: {
                embeds: [new EmbedBuilder()
                    .setColor(0x1b1b1b)
                    .setDescription("Couldn't find an entry relating to that")
                    .toJSON()]
            },
            link: "https://developer.mozilla.org/en-US/search?q=" + encodeURIComponent(content)
        };

        result.documents.length = 4;
        const results: { title: string; url: string }[] = [];
        messages[++messageNr] = {
            at: Date.now(),
            buttons: results,
            message: undefined as any
        };

        const components: MessageComponent[] = [{
            type: ComponentTypes.CONTAINER,
            components: result.documents.map((entry, i) => {
                results.push({
                    title: entry.title,
                    url: entry.mdn_url
                });

                return [
                    {
                        type: ComponentTypes.TEXT_DISPLAY,
                        content: `\n### [${entry.title}](https://developer.mozilla.org${entry.mdn_url})
${entry.summary}\n`
                    } satisfies TextDisplayComponent,
                    {
                        type: ComponentTypes.ACTION_ROW,
                        components: [
                            {
                                type: ComponentTypes.BUTTON,
                                style: ButtonStyles.SECONDARY,
                                label: "More info",
                                customID: `mdn:${ctx.author.id}:${messageNr}:${i}`
                            }
                        ]
                    } satisfies MessageActionRow
                ];
            }).flat()
        }];

        return {
            content: {
                components,
                flags: MessageFlags.IS_COMPONENTS_V2
            },
            link: "https://developer.mozilla.org/en-US/search?q=" + encodeURIComponent(content),
            afterSend: msg => messages[messageNr].message = msg
        };
    }
});
