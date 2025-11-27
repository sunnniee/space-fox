import { client, inCachedChannel } from "../client.ts";
import { promptHistory } from "../globals.ts";
import { geminiResponse, prompt } from "../utils/gemini.ts";
import { getPermissionTier, PermissionTier } from "../permissions.ts";
import type { PromptFunctions } from "../types.ts";

client.on("messageCreate", async msg => {
    if (!inCachedChannel(msg)
        || msg.referencedMessage?.author?.id !== client.user.id
        || ![PermissionTier.ME, PermissionTier.FRIENDS].includes(getPermissionTier(msg.author, msg.guild))
        // no need for a gemini api key check if you cant use the command in the first place
    )
        return;
    const historyItem = promptHistory[msg.referencedMessage.id];
    if (!historyItem || !historyItem.history.length || historyItem.userId !== msg.author.id) return;

    msg.channel.sendTyping();

    const tools = [] as PromptFunctions;
    tools.push("basic_calculator", "convert_currency", "convert_unit", "wikipedia", "search");
    if (process.env.WOLFRAMALPHA_API_KEY) tools.push("wolframalpha");

    const response =
        await prompt(msg.content, msg.attachments.toArray(), tools, {
            model: "gemini-2.5-flash-preview-09-2025",
            history: historyItem.history,
            reasoningBudget: 160
        });

    const res = geminiResponse(response);

    client.respond(msg, res)
        .then(resMsg => {
            if (!resMsg) return;
            if (!response.history.length)
                delete promptHistory[resMsg.id];
            else promptHistory[resMsg.id] = {
                userId: msg.author.id,
                history: response.history,
                at: Date.now()
            };
        });
});
