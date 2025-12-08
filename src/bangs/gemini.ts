import { promptHistory } from "../globals.ts";
import { geminiResponse, prompt } from "../utils/gemini.ts";
import { getPermissionTier, PermissionTier } from "../permissions.ts";
import { registerBang } from "../utils/bangs.ts";
import type { PromptFunctions, PromptOptions } from "../types.js";

registerBang({
    title: "Gemini",
    names: ["gemini", "gem", "ai"],
    predicate: () => !!process.env.GEMINI_API_KEY,
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
        let model = "gemini-2.5-flash-lite-preview-09-2025";
        const extraPerms = [PermissionTier.ME, PermissionTier.FRIENDS]
            .includes(getPermissionTier(ctx.author, ctx.guildID));
        if (extraPerms && !params.includes("q"))
            if (imageGeneration) model = "gemini-2.0-flash-preview-image-generation";
            else model = "gemini-2.5-flash-preview-09-2025";

        const tools = [] as PromptFunctions;
        tools.push("basic_calculator", "convert_currency", "convert_unit");
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
            reasoningBudget: params.includes("r") ? 2048 : 160
        };
        const response = await prompt(content, attachments, tools, options);

        const res = geminiResponse(response,
            params.includes("d") ? options : undefined,
            params.includes("d") ? 3000 : 3900);
        return {
            content: res,
            afterSend: msg => {
                if (!response.history.length)
                    delete promptHistory[msg.id];
                else promptHistory[msg.id] = {
                    userId: ctx.author.id,
                    history: response.history,
                    at: Date.now()
                };
            }
        };
    }
});
