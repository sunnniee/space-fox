import { EmbedBuilder } from "@oceanicjs/builders";
import { registerBang } from "../utils/bangs.ts";
import { debounce } from "../utils/debounce.ts";

registerBang({
    title: "xkcd",
    names: ["xkcd"],
    shortExecute: false,
    ignoreIfBlank: true,
    autocomplete: debounce(async content => {
        if (!content || content.length <= 3) return [];
        const search = await (
            await fetch(`https://www.explainxkcd.com/wiki/index.php?search=${encodeURIComponent(content)}\
&title=Special%3ASearch&profile=default&fulltext=1`)
        ).text();
        const searchMatches = search.match(/mw-search-result-heading.{0,100}title="\d+: .+?"/mg);
        return searchMatches?.map(result => ({ content: result.match(/title="(.+?)"/)![1]! })) ?? [];
    }, 400),
    execute: async content => {
        const search = await (
            await fetch(`https://www.explainxkcd.com/wiki/index.php?search=${encodeURIComponent(content)}\
&title=Special%3ASearch&profile=default&fulltext=1`)
        ).text();
        const searchMatch = search.match(/mw-search-result-heading.{0,100}title="(\d+): (.+?)"/m);
        if (!searchMatch) {
            return {
                content: {
                    embeds: [new EmbedBuilder()
                        .setColor(0xeeeeee)
                        .setDescription("Couldn't find that comic")
                        .toJSON()
                    ]
                },
                link: `https://www.google.com/search?q=${encodeURIComponent(`site:xkcd.com ${content}`)}`
            };
        }

        const [, id, title] = searchMatch;
        const comic = await (
            await fetch(`https://xkcd.com/${id}`)
        ).text();
        const match2 = comic.match(/<img src="\/\/(imgs.xkcd.com\/comics\/.+?\.\w{2,4})" title="(.+?)"/m);
        if (!match2) {
            return {
                content: {
                    embeds: [new EmbedBuilder()
                        .setColor(0xeeeeee)
                        .setAuthor(`${id}: ${title}`)
                        .setDescription("Failed to fetch comic")
                        .toJSON()
                    ]
                },
                link: `https://xkcd.com/${id}`
            };
        }
        const [_, link, titleTextHtml] = match2;
        const titleText = titleTextHtml!.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
        return {
            content: {
                embeds: [new EmbedBuilder()
                    .setColor(0xeeeeee)
                    .setAuthor(`${id}: ${title}`)
                    .setImage("https://" + link)
                    .setFooter(titleText)
                    .toJSON()
                ]
            },
            link: `https://xkcd.com/${id}`
        };
    }
});
