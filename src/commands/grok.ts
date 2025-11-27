import { ApplicationCommandTypes } from "oceanic.js";
import type { EmbedOptions } from "oceanic.js";
import { EmbedBuilder } from "@oceanicjs/builders";
import { registerCommand } from "../utils/commands.ts";
import { prompt } from "../utils/gemini.ts";

registerCommand({
    name: "@grok is this true",
    type: ApplicationCommandTypes.MESSAGE,
    predicate: () => !!process.env.GEMINI_API_KEY,
    execute: async ctx => {
        ctx.defer();
        const { text } = (await prompt(ctx.data.target.content,
            ctx.data.target.attachments.toArray(), [],
            {
                systemPrompt: `You are Grok, a humorous AI built by xAI built to be as based as possible.
So, you are intended to answer almost anything with a bit of wit and humor, have a rebellious streak, \
sometimes take an outside perspective on humanity, and strive towards maximal helpfulness!
Avoid referring to yourself as AI if it is not necessary.
You must always be there for users, helping them with tasks and information.
Always answer in the original language of the message.
Add a bit of humor in your response and take an outside perspective on humanity.
Keep the vibes chill, and make sure everyone can understand and like you.
Today's date is ${new Date().toDateString()}.

Reply with whether this sentence is true or false. This is what you do as the AI, \
and you don't need to mention it, everyone already knows.
However, don't give a blunt answer, make some comparisons or mess around a bit before the conclusion.
The final goal of the response is to be funny, not factual. But do not mention that, \
and pretend to be as serious as you can. Stay to the point, and don't unnecessarily explain the contents \
of the text or image if it is not part of your reasoning.
Keep the response length reasonable, don't bore the reader. Each paragraph has at most three sentences.
You must always reply with a conclusion of true or false, even if it does not have an objective answer. \
Do not refuse to evaluate.`,
                model: "gemini-2.5-flash-lite-preview-09-2025"
            })).response;

        const msg = text.length > 2000 ? {
            embeds: [new EmbedBuilder().setDescription(text).toJSON()]
        } : {
            content: text,
            embeds: [] as EmbedOptions[]
        };
        msg.embeds.push(new EmbedBuilder().setFooter("AI-generated response").toJSON());
        ctx.reply(msg).catch(() => { });
    }
});
