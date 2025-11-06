import { ButtonStyles, ComponentTypes, MessageFlags } from "oceanic.js";
import type { Message, MessageActionRow } from "oceanic.js";
import { ComponentBuilder, EmbedBuilder } from "@oceanicjs/builders";
import { PermissionTier } from "../permissions.ts";
import { registerBang } from "../utils/bangs.ts";
import { purgeOldValues } from "../utils/purge.ts";
import { client } from "../client.ts";
import { ComponentHandlerTypes } from "../types.ts";
import { search } from "../utils/search.ts";
import type { Result } from "../utils/search.ts";

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
        const { results } = await search(content);
        if (!results?.length) return {
            content: {
                content: "Failed to look that up",
                flags: MessageFlags.EPHEMERAL
            }
        };

        const id = resultId++;
        resultMap[id] = {
            results,
            message: undefined as any,
            at: Date.now()
        };

        return {
            content: resultMessage(resultMap[id].results, 0, id.toString(), ctx.author.id),
            afterSend: msg => resultMap[id]!.message = msg
        };
    },

    componentHandlers: [{
        match: /^search-/,
        type: ComponentHandlerTypes.BUTTON,
        handle: async ctx => {
            const [, id, indexStr, userId] = ctx.data.customID.split("-");
            if (!id || !indexStr || !userId) return; // never
            const index = parseInt(indexStr);
            if (ctx.user.id !== userId
                || !resultMap[id]
                || !resultMap[id].results[index]
            )
                return ctx.deferUpdate();
            return ctx.editParent(resultMessage(resultMap[id].results, index, id, ctx.user.id));
        }
    }]
});
