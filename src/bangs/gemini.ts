import { promptHistory } from "../globals.ts";
import { geminiResponse, prompt } from "../utils/gemini.ts";
import { getPermissionTier, PermissionTier } from "../permissions.ts";
import { registerBang } from "../utils/bangs.ts";
import type { PromptOptions } from "../types.js";

registerBang({
    title: "Gemini",
    names: ["gemini", "gem", "ai"],
    predicate: () => "GEMINI_API_KEY" in process.env,
    ignoreIfBlank: true,
    takesParameters: true,
    paramSuggestions: {
        l: "longer response",
        t: "use tools",
        lt: "both"
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
        let model = "gemini-2.5-flash-lite";
        if ([PermissionTier.ME, PermissionTier.FRIENDS].includes(getPermissionTier(ctx.author, ctx.guild))
            && !params.includes("q"))
            if (imageGeneration) model = "gemini-2.0-flash-preview-image-generation";
            else model = "gemini-2.5-flash";

        const options: PromptOptions = {
            systemPrompt: params.includes("l")
                ? undefined
                : "You are Gemini, a large language model. Keep your responses brief and to the point. Today is "
                    + new Date().toDateString(),
            model, imageGeneration,
            maxLength: params.includes("d") ? 3000 : 3900
        };
        const response = await prompt(content, attachments, params.includes("t") ? "all" : [], options);

        const res = geminiResponse(response, params.includes("d") ? options : undefined);
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
