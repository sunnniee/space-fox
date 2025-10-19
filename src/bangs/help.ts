import { bangs } from "../globals.ts";
import { bangsByTitle, canUseBang, registerBang } from "../utils/bangs.ts";

registerBang({
    title: "Show help",
    names: ["help", "h"],
    shortExecute: true,
    execute: async (_, __, ctx) => {
        const help = Object.entries(bangsByTitle()).filter(([_, values]) =>
            bangs[values[0]].restrict
                ? canUseBang(values[0], ctx.author, ctx.guildID)
                : true)
            .map(([name, values]) => `${name}: \`${values.join("`, `")}\``)
            .join("\n");

        return {
            content: `
Use "input !bang" to get the results for a certain bang
For example, "12 m to feet !cv"

${help}
                    `
        };
    }
});
