import { client, inCachedChannel } from "../client.ts";
import { promptHistory } from "../globals.ts";
import { geminiResponse, prompt } from "../utils/gemini.ts";
import { getPermissionTier, PermissionTier } from "../permissions.ts";

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

    const response =
        await prompt(msg.content, msg.attachments.toArray(), "all", {
            model: "gemini-2.5-flash-preview-09-2025",
            history: historyItem.history
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
