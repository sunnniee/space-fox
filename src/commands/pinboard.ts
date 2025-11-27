import { ApplicationCommandOptionTypes, ApplicationCommandTypes, ButtonStyles, ComponentTypes, MessageFlags, TextInputStyles } from "oceanic.js";
import type { AutocompleteChoice, ComponentInteraction, ContainerComponent, Embed, InteractionContent, SelectOption, TextButton, URLButton } from "oceanic.js";
import { ComponentBuilder } from "@oceanicjs/builders";
import { QuickScore } from "quick-score";
import { registerCommand } from "../utils/commands.ts";
import { JSONDatabase } from "../utils/database.ts";
import { ocr } from "../utils/ocr.ts";
import { attachmentUrlToImageInput, prompt } from "../utils/gemini.ts";
import { ComponentHandlerTypes } from "../types.ts";

interface PinboardItem {
    id: number;
    messageId: string;
    link: string;
    color: number;
    timestamp: number; /* ms */
    content: {
        text?: string;
        embedContent?: {
            text: string;
            imageUrl?: string;
        };
        media?: ({
            link: string;
            type: string;
            description?: string;
        })[];
        components?: (TextButton | URLButton)[];
    };
    searchableContent: string;
}

interface Pinboard {
    pins: PinboardItem[];
    lastPin: number;
}

export const allPinboards = new JSONDatabase<Pinboard>("data/pinboard.json");

const colors = [
    0xf5e0dc,
    0xf2cdcd,
    0xf5c2e7,
    0xcba6f7,
    0xf38ba8,
    0xeba0ac,
    0xfab387,
    0xf9e2af,
    0xa6e3a1,
    0x94e2d5,
    0x89dceb,
    0x74c7ec,
    0x89b4fa,
    0xb4befe,
    0xa6adc8,
    0x6c7086,
    0x313244
] as const;
const randomColor = () => colors[Math.floor(Math.random() * colors.length)];

function generateSearchableContent(pin: PinboardItem) {
    return `${pin.content.text || ""}
${pin.content.embedContent?.text || ""}
    
${pin.content.media?.map(i => i.description || "")?.join("\n") || ""}

${pin.content.components?.map(c => c.label || "")?.join("\n") || ""}`.trim();
}

function extractContentFromEmbed(embed: Embed | undefined) {
    if (!embed || !["rich", "link", "article", "video"].includes(embed.type!)) return undefined;
    if (embed.type === "video" && embed.provider?.name !== "YouTube") return undefined;
    const text = `${embed.author?.name ? `### ${embed.author.name}` : ""}
${embed.title ? `# ${embed.title}` : ""}
${embed.description?.slice(0, 3000) || ""}
${embed.footer?.text ? `-# ${embed.footer.text}` : ""}`.trim() || undefined;
    return {
        text,
        imageUrl: embed.thumbnail?.url
    };
}

async function fetchTenorGif(url: string): Promise<string | undefined> {
    const slug = url.split("/").at(-1)!;
    const id = slug.split("-").at(-1);
    if (!id) return undefined;
    const res = await (await fetch(`https://discord.com/api/v9/gifs/search?q=${slug}&media_format=gif`)).json();
    if (res && typeof res === "object" && Array.isArray(res)) {
        const gif = res.find(i => i.id === id);
        if (!gif) return undefined;
        return gif.src;
    }
    return undefined;

}

function makePinboardMessage(pin: PinboardItem, userId: string, id: number, idsLeft: number[], idsRight: number[],
    allSearchDisable?: { left: boolean; right: boolean }): InteractionContent {
    const components: ContainerComponent["components"] = [{
        type: ComponentTypes.TEXT_DISPLAY,
        content: `-# Pin #${pin.id} - <t:${Math.floor(pin.timestamp / 1000)}:R>
-# ${pin.link}`
    }, {
        type: ComponentTypes.SEPARATOR
    }];
    if (pin.content.text) components.push({
        type: ComponentTypes.TEXT_DISPLAY,
        content: pin.content.text
    });
    if (pin.content.embedContent?.text) {
        if (pin.content.embedContent.imageUrl)
            components.push({
                type: ComponentTypes.SECTION,
                components: [{
                    type: ComponentTypes.TEXT_DISPLAY,
                    content: pin.content.embedContent.text
                }],
                accessory: {
                    type: ComponentTypes.THUMBNAIL,
                    media: { url: pin.content.embedContent.imageUrl }
                }
            });
        else components.push({
            type: ComponentTypes.TEXT_DISPLAY,
            content: pin.content.embedContent.text
        });
    }
    if (pin.content.media?.length) components.push({
        type: ComponentTypes.MEDIA_GALLERY,
        items: pin.content.media.map(i => ({
            media: {
                url: i.link
            }
        }))
    });
    if (pin.content.components?.length)
        for (let i = 0; i < pin.content.components.length; i += 5) {
            const chunk = pin.content.components.slice(i, i + 5);
            components.push({
                type: ComponentTypes.ACTION_ROW,
                components: chunk
            });
        }
    const left = allSearchDisable ? "all" : idsLeft.join(",");
    const right = allSearchDisable ? "all" : idsRight.join(",");

    return {
        components: [{
            type: ComponentTypes.CONTAINER,
            accentColor: pin.color,
            components
        }, {
            type: ComponentTypes.ACTION_ROW,
            components: [{
                type: ComponentTypes.BUTTON,
                customID: `pin-left-${id}-${left}-${right}-${userId}`,
                style: ButtonStyles.PRIMARY,
                emoji: ComponentBuilder.emojiToPartial("⬅️"),
                disabled: allSearchDisable?.left ?? idsLeft.length === 0
            }, {
                type: ComponentTypes.BUTTON,
                customID: `pin-right-${id}-${left}-${right}-${userId}`,
                style: ButtonStyles.PRIMARY,
                emoji: ComponentBuilder.emojiToPartial("➡️"),
                disabled: allSearchDisable?.right ?? idsRight.length === 0
            }, {
                type: ComponentTypes.BUTTON,
                customID: `pinboard-manage-${id}-${userId}`,
                style: ButtonStyles.SECONDARY,
                label: "Edit image descriptions",
                disabled: !pin.content.media?.length
            }, {
                type: ComponentTypes.BUTTON,
                customID: `pinboard-delete-${id}-${userId}`,
                style: ButtonStyles.DANGER,
                label: "Remove pin"
            }, {
                type: ComponentTypes.BUTTON,
                customID: `pinboard-explode-${userId}`,
                style: ButtonStyles.SECONDARY,
                label: "Close the pinboard"
            }]
        }],
        flags: MessageFlags.IS_COMPONENTS_V2
    };
}

function descriptionModal(ctx: ComponentInteraction,
    pin: PinboardItem,
    imageIndex: number,
    value?: string,
    placeholder?: string) {
    return ctx.createModal({
        title: "Edit Image Description",
        customID: `pinboard-modal-${pin.id}-${imageIndex}`,
        components: [{
            type: ComponentTypes.ACTION_ROW,
            components: [{
                type: ComponentTypes.TEXT_INPUT,
                customID: "description",
                label: "New description",
                style: TextInputStyles.PARAGRAPH,
                maxLength: 1000,
                value,
                placeholder,
                required: false
            }]
        }]
    });
}

registerCommand({
    name: "pinboard",
    description: "A space to keep and search through important messages",
    type: ApplicationCommandTypes.CHAT_INPUT,
    options: [{
        name: "search",
        description: "Search query",
        type: ApplicationCommandOptionTypes.STRING,
        autocomplete: true,
        required: false
    }],
    autocomplete: async (ctx, query) => {
        if (!query || !query.length) return ctx.result([]);
        const pinboard = allPinboards.get(ctx.user.id);
        if (!pinboard || !pinboard.pins.length) return ctx.result([]);

        const scorer = new QuickScore(pinboard.pins, {
            keys: ["searchableContent"]
        });
        const results = scorer.search(query);

        const matches = [] as AutocompleteChoice[];

        for (const res of results) {
            if (!res.matches.searchableContent![0]) continue;

            const [matchStart, matchEnd] = res.matches.searchableContent![0];
            let segmentStart = Math.max(matchStart - 30, 0);
            let segmentEnd = Math.min(matchEnd + 50, res.scoreValue.length);
            const MAX_WORD_LENGTH = 12;

            if (segmentStart > 0) {
                let wordStart = segmentStart;
                while (wordStart > 0 && !res.scoreValue[wordStart - 1]!.match(/\s/)) {
                    wordStart--;
                }
                if (segmentStart - wordStart < MAX_WORD_LENGTH) {
                    segmentStart = wordStart;
                }
            }
            if (segmentEnd < res.scoreValue.length) {
                let wordEnd = segmentEnd;
                while (wordEnd < res.scoreValue.length && !res.scoreValue[wordEnd]!.match(/\s/)) {
                    wordEnd++;
                }
                if (wordEnd - segmentEnd < MAX_WORD_LENGTH) {
                    segmentEnd = wordEnd;
                }
            }

            let segment = res.scoreValue.replaceAll("\n", " ").substring(segmentStart, segmentEnd);
            if (segmentStart > 0) segment = "..." + segment;
            if (segmentEnd < res.scoreValue.length) segment += "...";
            if (segment.length > 100) {
                segment = segment.substring(0, 97) + "...";
            }

            matches.push({
                name: segment,
                value: `id:${res.item.id}`
            });
            if (matches.length >= 10) break;
        }

        return ctx.result(matches);
    },
    execute: async (ctx, search) => {
        const pinboard = allPinboards.get(ctx.user.id);
        if (!pinboard || !pinboard.pins.length) return ctx.reply({
            content: "Your pinboard is empty! This is a place to keep useful messages for later - add one by selecting a message and clicking `Apps > Add to pinboard`"
        });

        if (search?.match(/^id:\d+$/)) {
            const [, id] = search.split(":");
            if (!id) return; // never

            const pin = pinboard.pins.find(p => p.id === parseInt(id, 10));
            if (!pin) return ctx.reply({
                content: "Couldn't find anything relating to that",
                flags: MessageFlags.EPHEMERAL
            });

            return ctx.reply(makePinboardMessage(pin, ctx.user.id, parseInt(id, 10), [], []));
        }

        const ids = [] as number[];
        if (search) {
            const scorer = new QuickScore(pinboard.pins, {
                keys: ["searchableContent"]
            });
            const res = scorer.search(search);
            if (!res?.length) return ctx.reply({
                content: "Couldn't find anything relating to that",
                flags: MessageFlags.EPHEMERAL
            });
            if (res.length >= 10) res.length = 10;
            ids.push(...res.map(r => r.item.id));
        }
        if (!ids.length) ids.push(pinboard.pins.at(-1)!.id);
        const pin = pinboard.pins.find(p => p.id === ids[0])!;

        ctx.reply(makePinboardMessage(pin, ctx.user.id, ids[0]!, [], ids.slice(1),
            !search || search === "" ? { left: true, right: pinboard.pins.length === 1 } : undefined));
    },
    componentHandlers: [{
        match: /^pin-/,
        type: ComponentHandlerTypes.BUTTON,
        handle: async ctx => {
            const [, direction, idStr, leftStr, rightStr, userId] = ctx.data.customID.split("-");
            if (ctx.user.id !== userId) return ctx.deferUpdate();
            const pinboard = allPinboards.get(ctx.user.id, true);

            const id = Number(idStr);
            let all = false;
            let nextId: number | undefined = undefined;
            let left = [] as number[];
            let right = [] as number[];

            if (direction === "left") {
                if (leftStr === "all") {
                    const index = pinboard.pins.findIndex(p => p.id === id);
                    if (index !== pinboard.pins.length - 1) nextId = pinboard.pins[index + 1]!.id;
                    else return ctx.reply({
                        content: "There's nothing there..",
                        flags: MessageFlags.EPHEMERAL
                    });
                    all = true;
                } else {
                    const ids = leftStr ? leftStr.split(",").map(id => Number(id)) : [];
                    if (ids.length === 0) return ctx.reply({
                        content: "There's nothing there..",
                        flags: MessageFlags.EPHEMERAL
                    });
                    nextId = ids.at(-1);
                    left = ids.slice(0, -1);
                    right = [id, ...rightStr ? rightStr.split(",").map(id => Number(id)) : []];
                }
            } else if (direction === "right") {
                if (rightStr === "all") {
                    const index = pinboard.pins.findIndex(p => p.id === id);
                    if (index !== 0) nextId = pinboard.pins[index - 1]!.id;
                    else return ctx.reply({
                        content: "There's nothing there..",
                        flags: MessageFlags.EPHEMERAL
                    });
                    all = true;
                } else {
                    const ids = rightStr ? rightStr.split(",").map(id => Number(id)) : [];
                    if (ids.length === 0) return ctx.reply({
                        content: "There's nothing there..",
                        flags: MessageFlags.EPHEMERAL
                    });
                    nextId = ids[0];
                    left = [...leftStr ? leftStr.split(",").map(id => Number(id)) : [], id];
                    right = ids.slice(1);
                }
            }

            if (!nextId) return ctx.reply({
                content: "Something went wrong",
                flags: MessageFlags.EPHEMERAL
            });

            const nextPin = pinboard.pins.find(p => p.id === nextId)!,
                nextIndex = pinboard.pins.indexOf(nextPin);
            ctx.editParent(
                makePinboardMessage(nextPin, userId, nextId, left, right,
                    all ? {
                        left: nextIndex === pinboard.pins.length - 1,
                        right: nextIndex === 0
                    }
                        : undefined)
            );
        }
    }, {
        match: /^pinboard-manage-/,
        type: ComponentHandlerTypes.BUTTON,
        handle: async ctx => {
            const [, , id, userId] = ctx.data.customID.split("-");
            if (ctx.user.id !== userId) return ctx.deferUpdate();
            const pinboard = allPinboards.get(ctx.user.id, true);
            const pin = pinboard.pins.find(p => p.id === Number(id))!;

            if (!pin.content.media?.length) return ctx.reply({
                content: "how did you even get here",
                flags: MessageFlags.EPHEMERAL
            });

            ctx.reply({
                content: "Select the image that you want to edit",
                components: [{
                    type: ComponentTypes.ACTION_ROW,
                    components: [{
                        type: ComponentTypes.STRING_SELECT,
                        customID: `pinboard-select-${id}`,
                        options: pin.content.media!.map((img, i) => ({
                            label: `Image #${i + 1} - ${img.description?.length! > 75
                                ? img.description!.slice(0, 75) + "..."
                                : img.description || "[no description]"}`,
                            value: i.toString()
                        }))
                    }]
                }],
                flags: MessageFlags.EPHEMERAL
            });
        }
    }, {
        match: /^pinboard-select-/,
        type: ComponentHandlerTypes.STRING_SELECT,
        handle: async (ctx, pos) => {
            const [, , id] = ctx.data.customID.split("-");
            const pinboard = allPinboards.get(ctx.user.id, true);
            const pin = pinboard.pins.find(p => p.id === Number(id))!;
            const image = pin.content.media!.at(Number(pos));
            if (!image) return ctx.reply({
                content: "how did you even get here",
                flags: MessageFlags.EPHEMERAL
            });

            if (image.type.startsWith("video/"))
                return await descriptionModal(ctx, pin, Number(pos),
                    image.description, "Sorry, auto-generation is not supported for videos");
            else if (image.type === "image/gif")
                return await descriptionModal(ctx, pin, Number(pos),
                    image.description, "Sorry, auto-generation is not supported for GIFs");
            else {
                const options = [{
                    label: "Write a new description",
                    value: "write"
                }, {
                    label: "Read the text in the image (OCR)",
                    value: "ocr"
                }] satisfies SelectOption[];
                if (process.env.GEMINI_API_KEY) options.push({
                    label: "Let AI generate a description",
                    value: "generate"
                });

                await ctx.reply({
                    content: "Select an action",
                    components: [{
                        type: ComponentTypes.ACTION_ROW,
                        components: [{
                            type: ComponentTypes.STRING_SELECT,
                            customID: `pinboard-edit-${id}-${pos}`,
                            options
                        }]
                    }],
                    flags: MessageFlags.EPHEMERAL
                });
            }
        }
    }, {
        match: /^pinboard-edit-/,
        type: ComponentHandlerTypes.STRING_SELECT,
        handle: async (ctx, option) => {
            const [, , id, pos] = ctx.data.customID.split("-");
            const pinboard = allPinboards.get(ctx.user.id, true);
            const pin = pinboard.pins.find(p => p.id === Number(id))!;
            const index = pinboard.pins.indexOf(pin);
            const image = pin.content.media!.at(Number(pos));
            if (!image) return ctx.reply({
                content: "how did you even get here",
                flags: MessageFlags.EPHEMERAL
            });

            switch (option) {
                case "write": {
                    return await descriptionModal(ctx, pin, Number(pos), image.description);
                }
                case "ocr": {
                    await ctx.defer(MessageFlags.EPHEMERAL);
                    const img = await attachmentUrlToImageInput(image.link);
                    const res = await ocr(Buffer.from(img.data, "base64"));
                    if (!res || !res.content) return ctx.reply({
                        content: "Failed to generate",
                        flags: MessageFlags.EPHEMERAL
                    });

                    pin.content.media!.at(Number(pos))!.description = res.content;
                    pin.searchableContent = generateSearchableContent(pin);
                    pinboard.pins.splice(index, 1, pin);
                    allPinboards.set(ctx.user.id, pinboard);

                    return await ctx.reply({
                        content: `New description: **${res.content}**`,
                        flags: MessageFlags.EPHEMERAL
                    });
                }
                case "generate": {
                    await ctx.defer(MessageFlags.EPHEMERAL);
                    const res = await prompt(
                        "Generate a brief description of this image so it can be searched later.\
Avoid unnecessary details and use simple, casual language with common words.\
If there is text in the image, preserve the important parts. Include a list of tags at the end.\
Do not answer with anything other than the description.",
                        [{ url: image.link, contentType: image.type }], [],
                        {
                            model: "gemma-3-27b-it",
                            maxLength: 1000,
                        }
                    );
                    if (!res || !res.response.text) return ctx.reply({
                        content: "Failed to generate",
                        flags: MessageFlags.EPHEMERAL
                    });

                    pin.content.media!.at(Number(pos))!.description = res.response.text;
                    pin.searchableContent = generateSearchableContent(pin);
                    pinboard.pins.splice(index, 1, pin);
                    allPinboards.set(ctx.user.id, pinboard);

                    return await ctx.reply({
                        content: `New description: **${res.response.text}**`,
                        flags: MessageFlags.EPHEMERAL
                    });
                }
            }
        }
    }, {
        match: /^pinboard-modal-/,
        type: ComponentHandlerTypes.MODAL,
        handle: async (ctx, description) => {
            const [, , id, pos] = ctx.data.customID.split("-");
            const pinboard = allPinboards.get(ctx.user.id, true);
            const pin = pinboard.pins.find(p => p.id === Number(id))!;
            const index = pinboard.pins.indexOf(pin);

            pin.content.media!.at(Number(pos))!.description = description;
            pin.searchableContent = generateSearchableContent(pin);
            pinboard.pins.splice(index, 1, pin);
            allPinboards.set(ctx.user.id, pinboard);

            await ctx.reply({
                content: `New description: **${description || "[no description]"}**`,
                flags: MessageFlags.EPHEMERAL
            });
        }
    }, {
        match: /^pinboard-delete-/,
        type: ComponentHandlerTypes.BUTTON,
        handle: async ctx => {
            const [, , id, userId] = ctx.data.customID.split("-");
            if (ctx.user.id !== userId) return ctx.deferUpdate();

            ctx.reply({
                content: "Are you sure you want to delete this pin?",
                components: [{
                    type: ComponentTypes.ACTION_ROW,
                    components: [{
                        type: ComponentTypes.BUTTON,
                        customID: `pinboard-confirm-yes-${id}`,
                        label: "Yes",
                        style: ButtonStyles.SUCCESS
                    }, {
                        type: ComponentTypes.BUTTON,
                        customID: `pinboard-confirm-no-${id}`,
                        label: "No",
                        style: ButtonStyles.DANGER
                    }]
                }],
                flags: MessageFlags.EPHEMERAL
            });
        }
    }, {
        match: /^pinboard-confirm-/,
        type: ComponentHandlerTypes.BUTTON,
        handle: async ctx => {
            const [, , type, idStr] = ctx.data.customID.split("-");
            const id = Number(idStr);
            if (type === "no") {
                await ctx.deferUpdate();
                return await ctx.deleteOriginal();
            }

            const pinboard = allPinboards.get(ctx.user.id, true);
            const pin = pinboard.pins.find(p => p.id === id);
            if (!pin) return ctx.reply({
                content: "Something went wrong",
                flags: MessageFlags.EPHEMERAL
            });
            pinboard.pins.splice(pinboard.pins.indexOf(pin), 1);
            allPinboards.set(ctx.user.id, pinboard);

            await ctx.deferUpdate();
            await ctx.deleteOriginal();
            await ctx.reply({
                content: "👍️",
                flags: MessageFlags.EPHEMERAL
            });
        }
    }, {
        match: /^pinboard-explode-/,
        type: ComponentHandlerTypes.BUTTON,
        handle: async ctx => {
            const [, , userId] = ctx.data.customID.split("-");
            if (ctx.user.id !== userId) return ctx.deferUpdate();

            await ctx.deferUpdate();
            await ctx.deleteOriginal();
        }
    }]
});

registerCommand({
    name: "Add to pinboard",
    type: ApplicationCommandTypes.MESSAGE,
    execute: async ctx => {
        if (ctx.data.target.flags & MessageFlags.IS_COMPONENTS_V2) return ctx.reply({
            content: "Components V2 messages are not supported",
            flags: MessageFlags.EPHEMERAL
        });

        const pinboard = allPinboards.get(ctx.user.id) || { pins: [], lastPin: 0 };
        const { pins } = pinboard;
        const msg = ctx.data.target;

        const media = msg.attachments
            .filter(a => a.contentType
                && (a.contentType.startsWith("image/") || a.contentType.startsWith("video/")))
            .map(a => ({
                link: a.url,
                type: a.contentType,
                description: a.description || ""
            }));
        for await (const e of msg.embeds) {
            if (e.provider?.name === "Tenor") {
                const url = await fetchTenorGif(e.url!);
                media.push({
                    link: url || e.video!.url!,
                    type: "image/gif",
                    description: ""
                });
            } else if ((e.type === "image" || e.type === "gifv"
                || (e.type === "video" && e.provider?.name !== "YouTube")) && e.url) {
                media.push({
                    link: e.url,
                    type: (() => {
                        switch (e.type) {
                            case "image":
                                return "image/png";
                            case "gifv":
                                return "image/gif";
                            case "video":
                                return "video/mp4";
                        }
                    })(),
                    description: ""
                });
            }
        }

        if (pins.find(p => p.messageId === msg.id)) return ctx.reply({
            content: "That message is already pinned!",
            flags: MessageFlags.EPHEMERAL
        });

        const pin = {
            id: pinboard.lastPin + 1,
            messageId: msg.id,
            link: msg.jumpLink,
            color: randomColor(),
            timestamp: Date.now(),
            content: {
                text: msg.content,
                embedContent: extractContentFromEmbed(msg.embeds[0]),
                media,
                components: msg.components
                    .filter(c => c.type === ComponentTypes.ACTION_ROW)
                    .map(c => c.components).flat()
                    .filter(c => c.type === ComponentTypes.BUTTON && c.style !== ButtonStyles.PREMIUM)
                    .map(c => c.style === ButtonStyles.LINK
                        ? c
                        : { ...c, disabled: true, emoji: c.emoji?.id ? null : c.emoji })
            }
        } as PinboardItem;
        pin.searchableContent = generateSearchableContent(pin);

        pins.push(pin);
        allPinboards.set(ctx.user.id, {
            lastPin: pinboard.lastPin + 1,
            pins
        });

        return ctx.reply({
            content: "👍️",
            flags: MessageFlags.EPHEMERAL
        });
    }
});
