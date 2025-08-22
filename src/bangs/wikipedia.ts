import { ComponentBuilder, EmbedBuilder } from "@oceanicjs/builders";
import { ComponentTypes } from "oceanic.js";
import type { Message, MessageActionRow } from "oceanic.js";
import { wikipedia } from "../utils/wikipedia.ts";
import { client } from "../client.ts";
import { purgeOldValues } from "../utils/purge.ts";
import { registerBang } from "../utils/bangs.ts";
import { ComponentHandlerTypes } from "../types.ts";

const SEGMENT_MARKER = "@@segment marker@@";
function extractSegments(text: string): string[] /* [(Brief), start of content 1, (Top), content 1, title 2, content 2, ...] */ {
    const relevant = text.match(/<(?:p|h\d).+?<\/p>/gs);
    if (!relevant) return [];
    let result = `(Brief)${SEGMENT_MARKER}(Top)${SEGMENT_MARKER}\n`;
    result += relevant.join("")
        .replace(/<h2.*?>(.+?)<\/h2>/gs, `${SEGMENT_MARKER}$1${SEGMENT_MARKER}`)
        .replace(/<\/?(?:p|span).*?>/g, "")
        .trim()
        .replace(/\n+/g, "\n\n")
        .replace(/<math.*?<\/math>/gs, "[math expr hidden]")
        .replace(/<h3.*?>(.+?)<\/h3>/gs, "## $1")
        .replace(/<h4.*?>(.+?)<\/h4>/gs, "### $1")
        .replace(/<code.*?>|<\/code>/gm, "``")
        .replace(/<i.*?>|<\/i>/gm, "*")
        .replace(/<b.*?>|<\/b>|<strong.*?>|<\/strong>/gm, "**")
        .replace(/<\/?\w.*?>/gi, "");

    const segments = result.split(SEGMENT_MARKER);
    segments.splice(1, 0, segments[2].split("\n\n").slice(0, 2).join("\n\n"));
    return segments;
}

function reduce(text: string, maxParagraphs = Infinity) {
    const chunks = text.trim().split("\n\n");
    let result = "", reduced = false, paragraphNr = 0;
    for (const chunk of chunks) {
        if (!chunk.startsWith("#") && ++paragraphNr > maxParagraphs) break;
        if ((result + chunk).length > 4000) {
            reduced = true;
            break;
        } else result += chunk + "\n\n";
    }
    return { text: result, reduced };
}

let segmentNr = 42;
const allSegments: Record<string, {
    titles: string[];
    contents: string[];
    articleTitle: string;
    thumbnail: string;
    message: Message;
    at: number;
}> = {};

purgeOldValues(allSegments, 480_000, obj => {
    const msg = obj.message;
    if (msg) {
        client.editMessage(msg, {
            components: msg.components.filter(c =>
                c.type === ComponentTypes.ACTION_ROW && c.components[0].type !== ComponentTypes.STRING_SELECT
            ),
            allowedMentions: { repliedUser: false } // not sure why it needs this
        });
    }
});

const wikipediaEmbed = (articleTitle: string, articleSection: string, thumbnail: string, content: string, note: boolean) => {
    const embed = new EmbedBuilder()
        .setColor(0xffffff)
        .setAuthor(`${articleTitle}${articleSection ? ` - ${articleSection}` : ""}`,
            "https://upload.wikimedia.org/wikipedia/en/thumb/8/80/Wikipedia-logo-v2.svg/263px-Wikipedia-logo-v2.svg.png")
        .setDescription(content)
        .setThumbnail(thumbnail);
    if (note) embed.setFooter("Some content was hidden due to character limits");
    return embed.toJSON();
};

registerBang({
    title: "Wikipedia",
    names: ["wiki", "w", "wikipedia"],
    ignoreIfBlank: true,
    takesParameters: true,
    paramSuggestions: {
        en: "in English",
        fr: "in French"
    },
    exampleQueries: ["banana", "big O notation", "The Onion", "OneShot", "job application"],

    componentHandlers: [{
        match: /^wikipedia:/,
        type: ComponentHandlerTypes.STRING_SELECT,
        handle: async (ctx, pos) => {
            const [, id, segmentNr] = ctx.data.customID.split(":");
            const segment = allSegments[segmentNr];
            if (ctx.user.id !== id || !segment) return;

            const title = segment.titles[pos], content = segment.contents[pos];
            const { text: info, reduced } = reduce(content);

            const embed = wikipediaEmbed(
                segment.articleTitle,
                ["(Brief)", "(Top)"].includes(title) ? "" : title,
                segment.thumbnail,
                info,
                reduced
            );

            return ctx.editParent({
                embeds: [embed]
            });
        }
    }],

    execute: async (content, _, ctx, parameter) => {
        const result = await wikipedia(content, (parameter?.length === 2 ? parameter : "en").toLowerCase());
        if (result.error) return {
            content: {
                embeds: [new EmbedBuilder()
                    .setColor(0xffffff)
                    .setDescription(result.error)
                    .toJSON()]
            },
            link: "https://en.wikipedia.org/wiki/Special:Search?go=Go&search=" + encodeURIComponent(content)
        };

        let { text } = result;
        const { title, link, thumbnail } = result;
        text ??= "";
        const segments = extractSegments(text);

        const titles: string[] = [], contents: string[] = [];
        segments.forEach((s, i) => {
            if (i % 2 === 0) titles.push(s);
            else contents.push(s);
        });
        allSegments[++segmentNr] = {
            titles,
            contents,
            articleTitle: title,
            thumbnail,
            message: undefined as any,
            at: Date.now()
        };

        const select = new ComponentBuilder<MessageActionRow>()
            .addSelectMenu({
                type: ComponentTypes.STRING_SELECT,
                customID: `wikipedia:${ctx.author.id}:${segmentNr}`,
                options: titles.map((t, i) => ({ label: t, value: i.toString() }))
            })
            .toJSON();

        const { text: info, reduced } = reduce(contents[0]);

        return {
            content: {
                embeds: [wikipediaEmbed(title, "", thumbnail, info, reduced)],
                components: select
            },
            link,
            afterSend: msg => allSegments[segmentNr].message = msg
        };
    }
});
