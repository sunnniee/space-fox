import { EmbedBuilder } from "@oceanicjs/builders";
import type { EmbedField } from "oceanic.js";

import { registerBang } from "../utils/bangs.ts";

registerBang({
    title: "Wiktionary",
    names: ["wiktionary", "wkt", "wt"],
    ignoreIfBlank: true,
    exampleQueries: ["bedazzle", "nincompoop", "parallelogram", "aura farming", "shower"],
    execute: async content => {
        const query = await (
            await fetch(`https://en.wiktionary.org/w/api.php?action=opensearch&search=${encodeURIComponent(content)}&limit=1`)
        ).json();
        if (!Array.isArray(query) || !query[3][0]) return {
            content: {
                embeds: [new EmbedBuilder()
                    .setColor(0xffffff)
                    .setDescription("Couldn't find an entry relating to that")
                    .toJSON()]
            },
            link: "https://en.wiktionary.org/wiki/Special:Search?go=Go&search=" + encodeURIComponent(content)
        };

        const title = query[1][0];
        const article = await (
            await fetch(`https://en.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext&titles=${title}&format=json`)
        ).json() as any;
        const result = Object.values(article.query.pages as Record<string, any>)[0].extract as string;

        const fragment = result.split(/\n== \w+ ==/gi)[1]?.trim();
        if (!result.startsWith("\n== English ==") || !fragment) return {
            content: {
                embeds: [new EmbedBuilder()
                    .setColor(0xffffff)
                    .setDescription("Couldn't find a definition in English")
                    .toJSON()]
            },
            link: "https://en.wiktionary.org/wiki/" + encodeURIComponent(content)
        };

        const fields = fragment.split("\n\n\n").map(f => {
            const match = f.match(/^=+ ([\w ]+) =+\n(.*)/s);
            if (!match) return null;
            const [_, name, value] = match;
            if (
                ["Etymology", "Translations", "References", "Anagrams", "See also", "Further reading"].includes(name)
                || !value.trim()
            )
                return null;
            else return { name, value };
        }).filter(f => f) satisfies EmbedField[];

        return {
            content: {
                embeds: [new EmbedBuilder()
                    .setColor(0xffffff)
                    .setAuthor(title, "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Wiktionary-logo.svg/370px-Wiktionary-logo.svg.png")
                    .addFields(fields)
                    .toJSON()]
            },
            link: "https://en.wiktionary.org/wiki/" + encodeURIComponent(title)
        };
    }
});
