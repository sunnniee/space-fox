import { EmbedBuilder } from "@oceanicjs/builders";

import { registerBang } from "../utils/bangs.ts";

interface SearchResponse {
    list: {
        definiton: string;
        example: string;
        permalink: string;
        thumbs_up: string;
        thumbs_down: string;
    }[];
}

registerBang({
    title: "Urban Dictionary",
    names: ["urban", "ud", "urbandictionary"],
    ignoreIfBlank: true,
    execute: async content => {
        const query = await (
            await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(content)}`)
        ).json() as SearchResponse;
        if (!query?.list || query.list.length === 0) return {
            content: {
                embeds: [new EmbedBuilder()
                    .setColor(0xffa500)
                    .setDescription("the hell is that")
                    .toJSON()]
            },
            link: "https://www.urbandictionary.com/define.php?term=" + encodeURIComponent(content)
        };

        const def = (query.list as any[])
            .sort((a, b) => b.thumbs_up / b.thumbs_down < 0.5 ? 1 : b.thumbs_up - a.thumbs_up)[0];

        return {
            content: {
                embeds: [new EmbedBuilder()
                    .setColor(0xffa500)
                    .setAuthor(def.word)
                    .setDescription(`
${def.definition.replace(/\[(.+?)\]/gm,
    (_: string, t: string) => `[${t}](https://www.urbandictionary.com/define.php?term=${encodeURIComponent(t)})`)}

*${def.example.replace(/\[(.+?)\]/gm,
    (_: string, t: string) => `[${t}](https://www.urbandictionary.com/define.php?term=${encodeURIComponent(t)})`)}*`)
                    .toJSON()]
            },
            link: "https://www.urbandictionary.com/define.php?term=" + encodeURIComponent(def.word)
        };
    }
});
