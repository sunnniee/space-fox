import { EmbedBuilder } from "@oceanicjs/builders";

import { attachmentUrlToImageInput } from "../utils/gemini.ts";
import { ocr } from "../utils/ocr.ts";
import { bangs } from "../globals.ts";
import { registerBang } from "../utils/bangs.ts";

registerBang({
    title: "Image OCR",
    names: ["ocr", "text", "txt"],
    takesParameters: true,
    paramSuggestions: {
        tr: "then translate"
    },
    execute: async (_, attachments, __, params) => {
        const imgs = attachments?.filter(a => a.contentType?.startsWith("image/"));
        const embed = new EmbedBuilder()
            .setColor(0xf5c2e7);
        if (!imgs.length) return {
            content: {
                embeds: [embed.setDescription("No image provided").toJSON()]
            }
        };

        const img = await attachmentUrlToImageInput(imgs[0]!.url);
        const res = await ocr(Buffer.from(img.data, "base64"));
        if (!res) return {
            content: {
                embeds: [embed.setDescription("Failed to extract text").toJSON()]
            }
        };

        let text = res.content;
        let isTranslated = false;
        if (text && params?.toLowerCase().startsWith("tr") && bangs.translate) {
            const lang = params.split("-")[1];
            // TODO: move to util fuction instead of calling bang
            const translated = (await bangs.translate.execute(text, [], undefined as any, lang)).content;
            if (typeof translated === "string" || translated.content) {
                text = typeof translated === "string" ? translated : translated.content!;
                isTranslated = true;
            }
        }
        text = text.slice(0, 4096);

        embed
            .setDescription(text || "[no text detected]")
            .setFooter(`${isTranslated ? "Source language" : "Language"}: \
${res.language}${imgs.length > 1 ? " •︎ Only the first image was read" : ""}`);
        return {
            content: {
                embeds: [embed.toJSON()]
            }
        };
    }
});
