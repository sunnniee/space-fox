import { registerBang } from "../utils/bangs.ts";
import { convert } from "../utils/convert.ts";

registerBang({
    title: "Convert unit/currency",
    names: ["convert", "cv", "to"],
    ignoreIfBlank: true,
    exampleQueries: ["16 eur to usd", "94 f to c", "3 inches to cm", "0.4 btc to usd"],
    execute: async content => {
        const res = await convert(content);
        return {
            content: res
        };
    }
});
