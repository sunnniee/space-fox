import { ComponentTypes, MessageFlags } from "oceanic.js";
import type { CreateMessageOptions, MessageComponent } from "oceanic.js";

import type { InlineData, PromptHistoryItem, PromptOptions, PromptResult } from "../types.ts";
import { convert } from "./convert.ts";
import { wikipedia } from "./wikipedia.ts";
import { search } from "./search.ts";

type FunctionDefs = typeof functionDefs;

// Step 1: Convert JSON Schema types to TS types
type JSONSchemaType = { type: "string" | "number" | "boolean" };

type SchemaToTS<T extends Record<string, JSONSchemaType>> = {
    [K in keyof T]: T[K]["type"] extends "string" ? string
        : T[K]["type"] extends "number" ? number
            : T[K]["type"] extends "boolean" ? boolean
                : never;
};

// Step 2: Build a mapping of function name to its parameter object
type FunctionParamMap = {
    [F in FunctionDefs[number]as F["name"]]: SchemaToTS<F["parameters"]["properties"]>;
};

// Your function implementations must match this signature:
type FunctionImpls = {
    [K in keyof FunctionParamMap]: (args: FunctionParamMap[K]) => Promise<any>;
};

async function basicCalculator(input: string) {
    let res: number;
    try {
        res = eval(input.replace(/[^\d+\-*/.()]/g, "")
            .replace(/\++/g, "+").replace(/-+/g, "-")
            .replace(/\/+/g, "/")
            .replace(/\(\)/g, ""));
    } catch {
        return { error: "Failed to calculate" };
    }

    if (typeof res === "number") return { value: res.toString() };
    else return { error: "Failed to calculate" };
}

const functionDefs = [{
    name: "wikipedia",
    description: "Search english Wikipedia on a certain topic for general information about it.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The item to search about"
            }
        },
        required: ["query"]
    }
}, {
    name: "basic_calculator",
    description: "Perform basic maths. Supports only addition, subtraction, multiplication, division and exponentiation (via the ** symbol only).\
Only use round parenthesis ().",
    parameters: {
        type: "object",
        properties: {
            input: {
                type: "string",
                description: "The expression to evaluate"
            }
        },
        required: ["input"]
    }
}, {
    name: "convert_unit",
    description: 'Converts one unit to another. Supports converting units for angle, area, data transfer rate, data storage, duration, energy, \
force, frequency, length, mass, power, pressure, speed, temperature or volume. You can use shortenings of the units, ex "kg" or "m/s"',
    parameters: {
        type: "object",
        properties: {
            amount_from: {
                type: "string",
                description: "The amount to convert from"
            },
            unit_from: {
                type: "string",
                description: "The unit to convert from"
            },
            unit_to: {
                type: "string",
                description: "The unit to convert to"
            }
        },
        required: ["amount_from", "unit_from", "unit_to"]
    }
}, {
    name: "convert_currency",
    description: 'Converts the value of one currency to another. Use the full name of the country of origin (ex "United States dollar"). \
Can also be used for the value of cryptocurrency, in which case use the three letter short name (ex. BTC, XMR).',
    parameters: {
        type: "object",
        properties: {
            amount_from: {
                type: "string",
                description: "The amount to convert from"
            },
            currency_from: {
                type: "string",
                description: "The currency to convert from"
            },
            currency_to: {
                type: "string",
                description: "The currency to convert to"
            }
        },
        required: ["amount_from", "currency_from", "currency_to"]
    }
}, {
    name: "search",
    description: "Search the Internet. Provides some top results, the site they are from and a basic description of the site. \
For Reddit and StackExchange results, the first reply is provided instead.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The item to search about"
            }
        },
        required: ["query"]
    }
}] as const;

const functionCalls: FunctionImpls = {
    wikipedia: ({ query }) => wikipedia(query, "en", false, true),
    basic_calculator: ({ input }) => basicCalculator(input),
    convert_unit: async ({ amount_from, unit_from, unit_to }) => ({
        value: await convert(`${amount_from} ${unit_from} to ${unit_to}`, true)
    }),
    convert_currency: async ({ amount_from, currency_from, currency_to }) => ({
        value: await convert(`${amount_from} ${currency_from} to ${currency_to}`, true)
    }),
    search: async ({ query }) => ({ response: await search(query) })
};

export async function attachmentUrlToImageInput(url: string): Promise<InlineData> {
    const response = await fetch(url);
    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    return {
        mime_type: blob.type,
        data: buffer.toString("base64")
    };
}

function errorMessage(e: any) {
    if (!process.env.SUPPRESS_WARNINGS) console.log(e);
    if (!e) return "Unknown error";
    if (e.promptFeedback?.blockReason)
        return "Message blocked for " + e.promptFeedback.blockReason;
    else if (e.candidates && e.candidates?.[0]?.finishReason !== "STOP")
        return "Message generation failed for " + e.candidates[0].finishReason;
    else if (e.error?.message)
        return e.error.message;

    return "Unknown error";
}

export async function prompt(
    content: string,
    attachments: ({ url: string; contentType?: string })[],
    functions: FunctionDefs[number]["name"][] | "all",
    options: PromptOptions = {}
): Promise<PromptResult> {
    const { systemPrompt = undefined,
        maxLength = 3900,
        model = "gemini-2.0-flash",
        imageGeneration = false,
        history = [],
        reasoningBudget = 0
    } = options;

    const messages = [...history];
    if (content || attachments.length) {
        const message: PromptHistoryItem = {
            role: "user",
            parts: [{
                text: content
            }]
        };

        const fetchMedia = attachments
            ?.filter(a => ["image/", "video/", "audio/", "text/"].some(t => a.contentType?.startsWith(t)))
            .map(async a => ({
                inline_data: await attachmentUrlToImageInput(a.url)
            }));

        const media = await Promise.all(fetchMedia || []);
        media.forEach(input => {
            message.parts.push(input);
        });
        messages.push(message);
    }

    const body = {
        contents: messages,
        generationConfig: {
            responseModalities: ["text"].concat(imageGeneration ? ["image"] : [])
        }
    } as any;
    if (systemPrompt) body.system_instruction = {
        parts: {
            text: systemPrompt
        }
    };
    if (model.startsWith("gemini-2.5")) body.generationConfig.thinkingConfig = {
        thinkingBudget: reasoningBudget
    };

    const fns = functionDefs.filter(fn => {
        if (functions === "all") return true;
        else return functions.includes(fn.name);
    });
    if (fns.length) body.tools = [{ functionDeclarations: fns }];

    return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent\
?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    }).then(res => res.json().then(async res => {
        const parts = (res as any)?.candidates?.[0]?.content?.parts as {
            text?: string;
            inlineData?: { mimeType: string; data: string };
            functionCall?: { name: string; args: any };
        }[];
        if (!parts || parts.length === 0) return {
            response: {
                text: `Failed to generate: \`${errorMessage(res)}\``,
                images: []
            },
            history: []
        };

        if (parts?.[0]?.functionCall) {
            const call = parts[0].functionCall;
            const fn = functionDefs.find(f => f.name === call.name);
            if (fn) {
                const res = await functionCalls[fn.name](call.args);
                messages.push({ role: "model", parts: [{ functionCall: call }] });
                messages.push({ role: "user", parts: [{ functionResponse: { name: fn.name, response: res } }] });

                return prompt("", [], functions, { ...options, history: messages });
            }
        }

        const response = {
            text: "",
            images: [] as Buffer[]
        };
        parts.forEach(p => {
            if (p.text) {
                if (p.text.length < maxLength) response.text = p.text;
                else {
                    let { text } = p;
                    text = text.slice(0, maxLength - 10);

                    const codeblockParts = text.match(/```/g);
                    if (codeblockParts && codeblockParts.length % 2 === 1) text += "```";
                    text += " [...]";

                    response.text = text;
                }
            } else if (p.inlineData) {
                response.images.push(Buffer.from(p.inlineData.data, "base64"));
            }
        });

        return {
            response,
            history: messages
        };
    })).catch(e => {
        return {
            response: {
                text: `Failed to generate: \`${errorMessage(e)}\``,
                images: []
            },
            history: []
        };
    });
}

// TODO: image support untested cause im too broke for an image gen model
export function geminiResponse(response: PromptResult, debugInfo?: PromptOptions): CreateMessageOptions {
    const { text, images } = response.response;
    const container: MessageComponent = {
        type: ComponentTypes.CONTAINER,
        accentColor: 0x076EFF,
        components: []
    };

    if (text) container.components.push({
        type: ComponentTypes.TEXT_DISPLAY,
        content: text
    });
    if (images.length) container.components.push({
        type: ComponentTypes.MEDIA_GALLERY,
        items: images.map((_, i) => ({
            media: {
                url: `attachment://image${i}.png`
            }
        }))
    });
    if (debugInfo) container.components.push({
        type: ComponentTypes.TEXT_DISPLAY,
        content: `## Debug info
Using model \`${debugInfo.model}\`, image generation ${debugInfo.imageGeneration ? "on" : "off"}
Function calls:
${
    response.history.map(i => i.role === "model" && "functionCall" in i.parts[0]
        ? `\`${i.parts[0].functionCall.name}(${JSON.stringify(i.parts[0].functionCall.args)})\``
        : undefined).filter(i => i)
}`
    });
    container.components.push({
        type: ComponentTypes.TEXT_DISPLAY,
        content: "-# AI-generated response. Gemini makes mistakes, so double-check it."
    });

    return {
        components: [container],
        files: images.map((img, i) => ({ name: `image${i}.png`, contents: img })),
        flags: MessageFlags.IS_COMPONENTS_V2
    };
}
