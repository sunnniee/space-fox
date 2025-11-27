import { EmbedBuilder } from "@oceanicjs/builders";

import { PermissionTier } from "../permissions.ts";
import { registerBang } from "../utils/bangs.ts";

registerBang({
    title: "WolframAlpha",
    names: ["wolframalpha", "wa", "wolf"],
    predicate: () => !!process.env.WOLFRAMALPHA_API_KEY,
    restrict: [PermissionTier.ME, PermissionTier.FRIENDS],
    ignoreIfBlank: true,
    exampleQueries: ["sqrt of 1369", "28% of 3 km", "next solar eclipse", "value of MDCLXXIII"],
    execute: async content => {
        const req = await fetch(
            `http://api.wolframalpha.com/v1/result?i=${encodeURIComponent(content)}\
&appid=${process.env.WOLFRAMALPHA_API_KEY}`
        );
        const res = await req.text();
        return {
            content: {
                embeds: [new EmbedBuilder()
                    .setColor(0xffa32c)
                    .setAuthor(content, /* TODO: find a link to a logo */)
                    .setDescription(req.status !== 200 ? "```Failed to evaluate```" : "```" + res + "\n```")
                    .toJSON()]
            },
            link: "https://www.wolframalpha.com/input?i=" + encodeURIComponent(content)
        };
    }
});
