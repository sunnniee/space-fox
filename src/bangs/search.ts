import { parse } from "node-html-parser";
import { ButtonStyles, ComponentTypes, MessageFlags } from "oceanic.js";
import type { Message, MessageActionRow } from "oceanic.js";
import { ComponentBuilder, EmbedBuilder } from "@oceanicjs/builders";
import { PermissionTier } from "../permissions.ts";
import { registerBang } from "../utils/bangs.ts";
import { purgeOldValues } from "../utils/purge.ts";
import { client } from "../client.ts";
import { ComponentHandlerTypes } from "../types.ts";

type Result = {
    siteTitle: string;
    siteIcon: string;
    title: string;
    url: string;
    description: string;
};

let resultId = Math.floor(Math.random() * 10 ** 7);
const resultMap = {} as Record<string, {
    results: Result[];
    message: Message;
    at: number;
}>;
purgeOldValues(resultMap, 300_000, obj => {
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

function resultMessage(results: Result[], index: number, id: string, userId: string) {
    const result = results[index]!;
    return {
        embeds: [new EmbedBuilder()
            .setAuthor(result.siteTitle, result.siteIcon)
            .setColor(0xCC813E)
            .setDescription(`
## [${result.title}](${result.url})
${result.description}`)
            .setFooter(`Result ${index + 1}/${results.length}`)
            .toJSON()],
        components: new ComponentBuilder<MessageActionRow>()
            .addInteractionButton({
                customID: `search-${id}-${index - 1}-${userId}`,
                style: ButtonStyles.SECONDARY,
                disabled: index === 0,
                emoji: ComponentBuilder.emojiToPartial("⬅️")
            })
            .addInteractionButton({
                customID: `search-${id}-${index + 1}-${userId}`,
                style: ButtonStyles.SECONDARY,
                disabled: index === results.length - 1,
                emoji: ComponentBuilder.emojiToPartial("➡️")
            })
            .toJSON()
    };
}

registerBang({
    title: "Search",
    names: ["search", "s", "lookup"],
    ignoreIfBlank: true,
    restrict: [PermissionTier.FRIENDS, PermissionTier.ME],
    execute: async (content, _, ctx) => {
        const req = await fetch(
            "https://search.br" + `ave.com/search?q=${encodeURIComponent(content)}`,
            {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
                    "Cookie": "country=all; useLocation=0; summarizer=0;"
                }
            }
        );
        let results: Result[];
        try {
            if (req.status !== 200) throw new Error(`search: Got status code ${req.status}`);
            const res = await req.text();
            const html = parse(res);
            results = html.querySelectorAll(".snippet:has(> .heading-serpresult)").map(el => ({
                siteTitle: el.querySelector(".sitename").textContent,
                siteIcon: el.querySelector(".favicon").attrs.src,
                title: el.querySelector(".title").textContent,
                url: el.querySelector(".heading-serpresult").attrs.href,
                description: (el.querySelector(".snippet-description") || el.querySelector(".inline-qa-answer > p"))?.textContent || "[no description]"
            })) satisfies Result[];
            if (!results[0]) throw undefined;
        } catch(e) {
            if (e) console.log(e);
            return {
                content: {
                    content: "Failed to look that up",
                    flags: MessageFlags.EPHEMERAL
                }
            };
        }

        const id = resultId++;
        resultMap[id] = {
            results,
            message: undefined as any,
            at: Date.now()
        };

        return {
            content: resultMessage(resultMap[id].results, 0, id.toString(), ctx.author.id),
            afterSend: msg => resultMap[id].message = msg
        };
    },

    componentHandlers: [{
        match: /^search-/,
        type: ComponentHandlerTypes.BUTTON,
        handle: async ctx => {
            const [, id, index, userId] = ctx.data.customID.split("-");
            if (ctx.user.id !== userId
                || !resultMap[id]
                || !resultMap[id].results[index]
            )
                return ctx.deferUpdate();
            return ctx.editParent(resultMessage(resultMap[id].results, parseInt(index), id, ctx.user.id));
        }
    }]
});
