import { EmbedBuilder } from "@oceanicjs/builders";

import { registerBang } from "../utils/bangs.ts";

type SearchResponse = {
    pages: {
        id: number;
        key: string;
        title: string;
    }[];
};

registerBang({
    title: "Arch Linux wiki",
    names: ["arch", "a", "aw", "archwiki"],
    ignoreIfBlank: true,
    exampleQueries: ["pacman", "desktop environment", "discord", "grub", "steam", "ssh"],
    execute: async content => {
        const searchResult = await (
            await fetch(`https://wiki.archlinux.org/rest.php/v1/search/title?q=${encodeURIComponent(content)}&limit=1`)
        ).json() as SearchResponse;

        if (!("pages" in searchResult) || !searchResult.pages.length) return {
            content: {
                embeds: [new EmbedBuilder()
                    .setColor(0x0088cc)
                    .setDescription("Couldn't find an article relating to that")
                    .toJSON()
                ]
            },
            link: "https://wiki.archlinux.org/index.php?search=" + encodeURIComponent(content)
        };

        const { title, key } = searchResult.pages[0];
        const result = await (
            await fetch(`https://wiki.archlinux.org/rest.php/v1/page/${encodeURIComponent(key)}/html`)
        ).text();
        let text = result.match(/<section data-mw-section-id="0".+?<\/section>/s)?.[0];
        if (!text) return;

        text = text
            .replace(/<\/?section.*>|<link.*\/>|<\/?p.*?>|<meta.+?\/>|<\/?span.*?>|<\/?dd.*?>|<\/?dl.*?>/g, "")
            .replace(/<div class="(\w| )*?archwiki-template.+?<\/div>/gs, "")
            .trim()
            .replace(/<a .*?href="(.+?)".*?>(.+?)<\/a>/gm, "[$2]($1)")
            .replace(/\[(.+?)\]\(\.(.+?)\)/gm, "[$1](https://wiki.archlinux.org/title$2)")
            .replace(/\[(.+?)\]\(#(.+?)\)/gm, `[$1](https://wiki.archlinux.org/title/${encodeURIComponent(key)}#$2)`)
            .replace(/<a .*?><\/a>/gm, "")
            .replace(/<code.*?>|<\/code>/gm, "``")
            .replace(/<i.*?>|<\/i>/gm, "*")
            .replace(/<b.*?>|<\/b>|<strong.*?>|<\/strong>/gm, "**")
            .replace(/<\/?\w.*?>/gi, "");

        return {
            content: {
                embeds: [new EmbedBuilder()
                    .setColor(0x0088cc)
                    .setAuthor(title, "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Arch_Linux_%22Crystal%22_icon.svg/250px-Arch_Linux_%22Crystal%22_icon.svg.png")
                    .setDescription(text)
                    .toJSON()
                ]
            },
            link: "https://wiki.archlinux.org/title/" + encodeURIComponent(key)
        };
    }
});
