import { ButtonStyles, ComponentTypes, MessageFlags, TextInputStyles } from "oceanic.js";
import type { ContainerComponent, SeparatorComponent, TextDisplayComponent, ModalActionRow } from "oceanic.js";
import { QuickScore } from "quick-score";
import { ComponentBuilder } from "@oceanicjs/builders";
import { attachmentUrlToImageInput } from "../utils/gemini.ts";
import { ocr } from "../utils/ocr.ts";
import { registerBang } from "../utils/bangs.ts";
import { ComponentHandlerTypes } from "../types.ts";
import { googleTranslate } from "../utils/translate.ts";

const langCodes: Record<string, string> = { aa: "Afar", ab: "Abkhazian", ae: "Avestan", af: "Afrikaans", ak: "Akan", am: "Amharic", an: "Aragonese", ar: "Arabic", as: "Assamese", av: "Avaric", ay: "Aymara", az: "Azerbaijani", ba: "Bashkir", be: "Belarusian", bg: "Bulgarian", bh: "Bihari languages", bi: "Bislama", bm: "Bambara", bn: "Bengali", bo: "Tibetan", br: "Breton", bs: "Bosnian", ca: "Catalan; Valencian", ce: "Chechen", ch: "Chamorro", co: "Corsican", cr: "Cree", cs: "Czech", cu: "Church Slavic; Old Slavonic; Church Slavonic; Old Bulgarian; Old Church Slavonic", cv: "Chuvash", cy: "Welsh", da: "Danish", de: "German", dv: "Divehi; Dhivehi; Maldivian", dz: "Dzongkha", ee: "Ewe", el: "Greek, Modern (1453-)", en: "English", eo: "Esperanto", es: "Spanish; Castilian", et: "Estonian", eu: "Basque", fa: "Persian", ff: "Fulah", fi: "Finnish", fj: "Fijian", fo: "Faroese", fr: "French", fy: "Western Frisian", ga: "Irish", gd: "Gaelic; Scomttish Gaelic", gl: "Galician", gn: "Guarani", gu: "Gujarati", gv: "Manx", ha: "Hausa", he: "Hebrew", hi: "Hindi", ho: "Hiri Motu", hr: "Croatian", ht: "Haitian; Haitian Creole", hu: "Hungarian", hy: "Armenian", hz: "Herero", ia: "Interlingua (International Auxiliary Language Association)", id: "Indonesian", ie: "Interlingue; Occidental", ig: "Igbo", ii: "Sichuan Yi; Nuosu", ik: "Inupiaq", io: "Ido", is: "Icelandic", it: "Italian", iu: "Inuktitut", ja: "Japanese", jv: "Javanese", ka: "Georgian", kg: "Kongo", ki: "Kikuyu; Gikuyu", kj: "Kuanyama; Kwanyama", kk: "Kazakh", kl: "Kalaallisut; Greenlandic", km: "Central Khmer", kn: "Kannada", ko: "Korean", kr: "Kanuri", ks: "Kashmiri", ku: "Kurdish", kv: "Komi", kw: "Cornish", ky: "Kirghiz; Kyrgyz", la: "Latin", lb: "Luxembourgish; Letzeburgesch", lg: "Ganda", li: "Limburgan; Limburger; Limburgish", ln: "Lingala", lo: "Lao", lt: "Lithuanian", lu: "Luba-Katanga", lv: "Latvian", mg: "Malagasy", mh: "Marshallese", mi: "Maori", mk: "Macedonian", ml: "Malayalam", mn: "Mongolian", mr: "Marathi", ms: "Malay", mt: "Maltese", my: "Burmese", na: "Nauru", nb: "Bokmål, Norwegian; Norwegian Bokmål", nd: "Ndebele, North; North Ndebele", ne: "Nepali", ng: "Ndonga", nl: "Dutch; Flemish", nn: "Norwegian Nynorsk; Nynorsk, Norwegian", no: "Norwegian", nr: "Ndebele, South; South Ndebele", nv: "Navajo; Navaho", ny: "Chichewa; Chewa; Nyanja", oc: "Occitan (post 1500)", oj: "Ojibwa", om: "Oromo", or: "Oriya", os: "Ossetian; Ossetic", pa: "Panjabi; Punjabi", pi: "Pali", pl: "Polish", ps: "Pushto; Pashto", pt: "Portuguese", qu: "Quechua", rm: "Romansh", rn: "Rundi", ro: "Romanian; Moldavian; Moldovan", ru: "Russian", rw: "Kinyarwanda", sa: "Sanskrit", sc: "Sardinian", sd: "Sindhi", se: "Northern Sami", sg: "Sango", si: "Sinhala; Sinhalese", sk: "Slovak", sl: "Slovenian", sm: "Samoan", sn: "Shona", so: "Somali", sq: "Albanian", sr: "Serbian", ss: "Swati", st: "Sotho, Southern", su: "Sundanese", sv: "Swedish", sw: "Swahili", ta: "Tamil", te: "Telugu", tg: "Tajik", th: "Thai", ti: "Tigrinya", tk: "Turkmen", tl: "Tagalog", tn: "Tswana", to: "Tonga (Tonga Islands)", tr: "Turkish", ts: "Tsonga", tt: "Tatar", tw: "Twi", ty: "Tahitian", ug: "Uighur; Uyghur", uk: "Ukrainian", ur: "Urdu", uz: "Uzbek", ve: "Venda", vi: "Vietnamese", vo: "Volapük", wa: "Walloon", wo: "Wolof", xh: "Xhosa", yi: "Yiddish", yo: "Yoruba", za: "Zhuang; Chuang", zh: "Chinese", zu: "Zulu" };

const languageList = Object.entries(langCodes).flatMap(([code, nameStr]) => {
    const names = nameStr.split("; ");
    return [
        { code, match: code },
        ...names.map(name => ({ code, match: name.toLowerCase() }))
    ];
});
const scorer = new QuickScore(languageList, { keys: ["match"] });

registerBang({
    title: "Image OCR",
    names: ["ocr", "text", "txt"],
    execute: async (_, attachments, ctx) => {
        const imgs = attachments?.filter(a => a.contentType?.startsWith("image/"));
        if (!imgs.length) return { content: {
            content: "No image provided",
            flags: MessageFlags.EPHEMERAL
        } };

        const images = await Promise.all(imgs.map(i => attachmentUrlToImageInput(i.url)));
        const startDuration = performance.now();
        const res = await Promise.all(images.map(async i => {
            return ocr(Buffer.from(i.data, "base64")).then(data => ({ data, duration: performance.now() }));
        }));

        const container = {
            type: ComponentTypes.CONTAINER,
            components: [] as (TextDisplayComponent | SeparatorComponent)[]
        } satisfies ContainerComponent;
        res.forEach(({ data, duration }, i) => {
            container.components.push({
                type: ComponentTypes.TEXT_DISPLAY,
                content: data
                    ? data.content.replace(/!\[(.+?)\]\(.+?\)/g, "($1)")
                    : "Failed to extract or no content"
            });
            container.components.push({
                type: ComponentTypes.TEXT_DISPLAY,
                content: `-# ${(data && langCodes[data.language]) || "Unknown"} •︎ ${((duration - startDuration) / 1000).toFixed(2)}s`
            });
            if (i !== res.length - 1) container.components.push({ type: ComponentTypes.SEPARATOR });
        });

        return {
            content: {
                components: [container, {
                    type: ComponentTypes.ACTION_ROW,
                    components: [{
                        type: ComponentTypes.BUTTON,
                        customID: "ocrenglish-" + ctx.author.id,
                        style: ButtonStyles.SECONDARY,
                        label: "English",
                        emoji: ComponentBuilder.emojiToPartial("<:translate:1452745360232681653>")
                    }, {
                        type: ComponentTypes.BUTTON,
                        customID: "ocrother-" + ctx.author.id,
                        style: ButtonStyles.SECONDARY,
                        label: "Other language",
                        emoji: ComponentBuilder.emojiToPartial("<:translate:1452745360232681653>")
                    }]
                }],
                flags: MessageFlags.IS_COMPONENTS_V2
            }
        };
    },
    componentHandlers: [{
        match: /^ocrenglish-/,
        type: ComponentHandlerTypes.BUTTON,
        handle: async ctx => {
            const [, id] = ctx.data.customID.split("-");
            if (!id || id !== ctx.user.id) return ctx.deferUpdate();
            if (ctx.message.components[0]?.type !== ComponentTypes.CONTAINER) return ctx.deferUpdate();

            ctx.deferUpdate();
            const text = (ctx.message.components[0] as ContainerComponent).components
                .filter(c => c.type === ComponentTypes.TEXT_DISPLAY)
                .map((c, i, a) => i % 2 === 0
                    ? a[i + 1]!.content.startsWith("English •︎ ") ? undefined : c.content
                    : c.content)
                .filter((_, i) => i % 2 === 0);
            const translations = await Promise.all(text.map(t =>
                t ? googleTranslate(t, "en") : Promise.resolve(undefined)));

            ctx.editOriginal({
                components: [{
                    type: ComponentTypes.CONTAINER,
                    components: (ctx.message.components[0] as ContainerComponent).components.map((c, i) => {
                        switch (i % 3) {
                            case 0: {
                                const index = Math.floor(i / 3);
                                if (translations[index]) return {
                                    type: ComponentTypes.TEXT_DISPLAY,
                                    content: translations[index].text
                                };
                                else return c;
                            }
                            case 1: {
                                const duration = (c as TextDisplayComponent).content.split(" •︎ ")[1]!;
                                const translation = translations[Math.floor(i / 3)];
                                if (!translation) return c;
                                return {
                                    type: ComponentTypes.TEXT_DISPLAY,
                                    content: `-# From ${(translation && langCodes[translation.sourceLanguage]) || "Unknown"} •︎ ${duration}`
                                };
                            }
                            default:
                                return c;
                        }
                    })
                }]
            });
        }
    }, {
        match: /^ocrother-/,
        type: ComponentHandlerTypes.BUTTON,
        handle: async ctx => {
            const [, id] = ctx.data.customID.split("-");
            if (!id || id !== ctx.user.id) return ctx.deferUpdate();

            return ctx.createModal({
                title: "Translate to...",
                customID: "ocrmodal-" + id,
                components: new ComponentBuilder<ModalActionRow>()
                    .addTextInput({
                        customID: "language",
                        label: "Language",
                        style: TextInputStyles.SHORT,
                        placeholder: "Language code or name (e.g. es, French)",
                        required: true,
                        maxLength: 20
                    })
                    .toJSON()
            });
        }
    }, {
        match: /^ocrmodal-/,
        type: ComponentHandlerTypes.MODAL,
        handle: async (ctx, language) => {
            const [, id] = ctx.data.customID.split("-");
            if (!id || id !== ctx.user.id) return ctx.deferUpdate();
            if (!ctx.message || ctx.message.components[0]?.type !== ComponentTypes.CONTAINER) return ctx.deferUpdate();

            const lowerInput = language.trim().toLowerCase();
            let targetCode: string | undefined = undefined;

            if (lowerInput.length <= 1) {
                return ctx.reply({
                    content: "You need to use an actual language",
                    flags: MessageFlags.EPHEMERAL
                });
            }
            if (langCodes[lowerInput]) {
                targetCode = lowerInput;
            } else {
                const results = scorer.search(lowerInput);
                if (results.length > 0 && results[0]!.score > 0.8) {
                    targetCode = results[0]!.item.code;
                }
            }
            if (!targetCode) {
                return ctx.reply({
                    content: "Couldn't figure out what language that is",
                    flags: MessageFlags.EPHEMERAL
                });
            }

            ctx.deferUpdate();
            const text = (ctx.message.components[0] as ContainerComponent).components
                .filter(c => c.type === ComponentTypes.TEXT_DISPLAY)
                .map((c, i) => i % 2 === 0 ? c.content : undefined)
                .filter((_, i) => i % 2 === 0) as string[];

            const translations = await Promise.all(text.map(t =>
                t ? googleTranslate(t, targetCode!).catch(() => undefined) : Promise.resolve(undefined)));

            ctx.editOriginal({
                components: [{
                    type: ComponentTypes.CONTAINER,
                    components: (ctx.message.components[0] as ContainerComponent).components.map((c, i) => {
                        switch (i % 3) {
                            case 0: {
                                const index = Math.floor(i / 3);
                                if (translations[index]) return {
                                    type: ComponentTypes.TEXT_DISPLAY,
                                    content: translations[index]!.text
                                };
                                else return c;
                            }
                            case 1: {
                                const duration = (c as TextDisplayComponent).content.split(" •︎ ")[1]!;
                                const translation = translations[Math.floor(i / 3)];
                                if (!translation) return c;
                                return {
                                    type: ComponentTypes.TEXT_DISPLAY,
                                    content: `-# ${(translation && langCodes[translation.sourceLanguage]) || "Unknown"} -> ${langCodes[targetCode]} •︎ ${duration}`
                                };
                            }
                            default:
                                return c;
                        }
                    })
                }]
            });
        }
    }]
});
