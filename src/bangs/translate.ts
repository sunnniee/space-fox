import { EmbedBuilder } from "@oceanicjs/builders";
import type { CreateMessageOptions, MessageActionRow, MessageActionRowComponent } from "oceanic.js";
import { ButtonStyles, CommandInteraction, ComponentTypes, MessageFlags } from "oceanic.js";

import { registerBang } from "../utils/bangs.ts";
import { googleTranslate } from "../utils/translate.ts";

function setDeepValue(obj: Record<string, any>, path: string, value: any) {
    const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let current = obj;

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]!;
        const isLast = i === keys.length - 1;

        if (isLast) {
            current[key] = value;
        } else {
            if (!(key in current)) {
                current[key] = isNaN(Number(keys[i + 1])) ? {} : [];
            }
            current = current[key];
        }
    }
}

registerBang({
    title: "Translate",
    names: ["translate", "trans", "tr"],
    ignoreIfBlank: true,
    takesParameters: true,
    paramSuggestions: {
        en: "to English",
        fr: "to French"
    },
    execute: async (content, _, ctx, params) => {
        const lang = params || "en";
        const fields: Record<string, any> = {};
        const isBasic = !ctx || ctx instanceof CommandInteraction || (!ctx.embeds?.length && !ctx.components?.length);

        if (isBasic)
            fields.content = content;
        else {
            if (ctx.flags & MessageFlags.IS_COMPONENTS_V2) return {
                content: "Components V2 messages are not supported"
            };
            fields.content = ctx.content;
            if (ctx.embeds.length > 9) ctx.embeds.length = 9;

            ctx.embeds.forEach((e, i) => {
                fields[`embeds[${i}].title`] = e.title;
                fields[`embeds[${i}].author.name`] = e.author?.name;
                fields[`embeds[${i}].description`] = e.description;
                fields[`embeds[${i}].footer.text`] = e.footer?.text;
                e.fields?.forEach((f, j) => {
                    fields[`embeds[${i}].fields[${j}].name`] = f.name;
                    fields[`embeds[${i}].fields[${j}].value`] = f.value;
                });
            });

            ctx.components.forEach((row, i) => {
                if (row.type !== ComponentTypes.ACTION_ROW) return; // never
                row.components.forEach((c, j) => {
                    if (c.type === ComponentTypes.BUTTON && c.style !== ButtonStyles.PREMIUM)
                        fields[`components[${i}].components[${j}].label`] = c.label;
                });
            });

            for (const [key, value] of Object.entries(fields))
                if (!value) delete fields[key];
        }
        let translations: ({ pos: string; text: string })[];
        try {
            translations = await Promise.all(Object.entries(fields).map(([pos, text]) =>
                googleTranslate(text, lang).then(({ text }) => Promise.resolve({ pos, text }))));
        } catch {
            return {
                content: "Failed to translate"
            };
        }

        const msg: CreateMessageOptions = isBasic ? { content } : {
            content: ctx.content,
            embeds: structuredClone(ctx.embeds).concat([
                new EmbedBuilder().setFooter("Translated via Google Translate").toJSON()
            ]),
            components: ctx.components.map(row => ({
                type: ComponentTypes.ACTION_ROW,
                components: (row as MessageActionRow).components.map(c =>
                    c.type === ComponentTypes.BUTTON && c.style !== ButtonStyles.PREMIUM
                        ? c.style === ButtonStyles.LINK
                            ? c
                            : { ...c, disabled: true, emoji: c.emoji?.id ? null : c.emoji }
                        : null).filter(Boolean) as MessageActionRowComponent[]
            }))
        };
        translations.forEach(({ pos, text }) =>
            setDeepValue(msg, pos, text));
        return {
            content: msg
        };
    }
});
