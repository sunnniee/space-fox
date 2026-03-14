import { ComponentTypes, MessageFlags } from "oceanic.js";
import type { AnyInteractionChannel, Message, Uncached } from "oceanic.js";
import { promptHistory } from "../globals.ts";
import { geminiResponse, prompt } from "../utils/gemini.ts";
import { getPermissionTier, PermissionTier } from "../permissions.ts";
import { registerBang } from "../utils/bangs.ts";
import type { Context, PromptFunctions, PromptOptions, PromptResult } from "../types.js";

async function respondWithPrompt(
    msg: Message<AnyInteractionChannel | Uncached>,
    ctx: Context,
    prompt: Promise<PromptResult>,
    withDebugInfo?: PromptOptions
) {
    const response = await prompt;

    const textResponse = geminiResponse(response,
        withDebugInfo || undefined,
        withDebugInfo ? 3000 : 3900);
    await ctx.editSelf({ ...textResponse, flags: msg.flags });

    if (!response.history.length)
        delete promptHistory[msg.id];
    else promptHistory[msg.id] = {
        userId: msg.author.id,
        history: response.history,
        at: Date.now()
    };
}

registerBang({
    title: "Gemini",
    names: ["gemini", "gem", "ai"],
    predicate: () => !!process.env.GEMINI_API_KEY,
    restrict: [PermissionTier.ME, PermissionTier.FRIENDS],
    ignoreIfBlank: true,
    takesParameters: true,
    paramSuggestions: {
        l: "longer response",
        s: "search the internet",
        r: "reason for longer",
        ls: "both long response and search"
    },
    exampleQueries: [
        "why is the sky blue",
        "how many hours are in a week",
        "what is the meaning of life and the universe and everything",
        "explain Array.reduce in javascript",
        "is this real",
        "do we live in a simulation",
        "are we being controlled by dog overlords",
        "write a haiku about touching grass",
        "give me 5 reasons to touch grass",
        "write some funny example queries for an ai"
    ],
    execute: async (content, attachments, ctx, parameter) => {
        const params = parameter?.toLowerCase().split("") || [];
        const imageGeneration = params.includes("i");
        let model = "gemini-3.1-flash-lite-preview";
        const extraPerms = [PermissionTier.ME, PermissionTier.FRIENDS]
            .includes(getPermissionTier(ctx.author, ctx.guildID));
        if (extraPerms && !params.includes("q"))
            if (imageGeneration) model = "gemini-2.0-flash-preview-image-generation";
            else model = "gemini-3-flash-preview";

        const tools = [] as PromptFunctions;
        tools.push("convert_currency", "convert_unit");
        if (params.includes("s")) {
            tools.push("wikipedia", "search");
            if (extraPerms && process.env.WOLFRAMALPHA_API_KEY) tools.push("wolframalpha");
        }

        let systemPrompt = `
You are Gemini, a large language model. The current date and time is ${new Date().toUTCString()}.
Basic markdown is supported: bold, italic, underline, strikethrough, headers, links, ordered and unordered lists.
You can also use spoliers: ||spoiler text here|| and block quotes: > Hey!
Anything else like images or tables are NOT supported.
If you need to use the symbols >, |, _, *, ~, @, #, \`, put a backslash before them to escape them.
If the user is chatting casually, your responses should be only a few sentences.`.trim();
        if (tools.includes("search")) systemPrompt += `
If you use search results in your response, cite them. You can do so by adding {{src:n,m,p}} \
at the end of the sentence (after punctuation), where n, m, p are result indexes, counting from 1.
If there were multiple search operatons done, specify which with {{src:n;1,2,3}}, also counting from 1.`;

        const options: PromptOptions = {
            systemPrompt: params.includes("l")
                ? undefined
                : systemPrompt,
            model, imageGeneration,
            reasoning: params.includes("r")
        };
        const response = prompt(content, attachments, tools, options);

        return {
            content: {
                components: [{
                    type: ComponentTypes.CONTAINER,
                    accentColor: 0x076EFF,
                    components: [{
                        type: ComponentTypes.MEDIA_GALLERY,
                        items: [{ media: { url: "https://bignutty.gitlab.io/webstorage4/v2/assets/loading/05_chat_loading.7y2ji893rho0.gif" } }]
                    }, {
                        type: ComponentTypes.TEXT_DISPLAY,
                        content: "-# AI-generated response. Gemini makes mistakes, so double-check it."
                    }]
                }],
                flags: MessageFlags.IS_COMPONENTS_V2
            },
            afterSend: msg => respondWithPrompt(
                msg,
                ctx,
                response,
                params.includes("d") ? options : undefined
            )
        };
    }
});
