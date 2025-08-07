import { ComponentBuilder, EmbedBuilder } from "@oceanicjs/builders";
import type { CommandInteraction, ModalActionRow, ModalSubmitInteraction } from "oceanic.js";
import { ApplicationCommandTypes, InteractionTypes, MessageFlags, TextInputStyles } from "oceanic.js";

import { client } from "../client.ts";
import type { RemindersItem } from "../types.d.ts";
import { reminders } from "../utils/reminders.ts";

function parseDate(date: string): number | void {
    const parts = date.match(/(\d+|\D+)/g);
    if (!parts || !parts.length) return;
    if (!parseInt(parts[0], 10)) parts.shift();
    if (parts.length % 2 === 1) return;

    let time = 0;
    const multipliers = {
        second: 1,
        minute: 60,
        hour: 60 * 60,
        day: 60 * 60 * 24,
        week: 60 * 60 * 24 * 7,
        month: 60 * 60 * 24 * 30,
        year: 60 * 60 * 24 * 365
    };
    for (let i = 0; i < parts.length; i += 2) {
        switch (parts[i + 1].replace(/[^a-zA-Z]/g, "")) {
            case "s":
            case "sec":
            case "secs":
            case "second":
            case "seconds":
                time += parseInt(parts[i], 10) * multipliers.second;
                break;
            case "m":
            case "min":
            case "mins":
            case "minute":
            case "minutes":
                time += parseInt(parts[i], 10) * multipliers.minute;
                break;
            case "h":
            case "hr":
            case "hrs":
            case "hour":
            case "hours":
                time += parseInt(parts[i], 10) * multipliers.hour;
                break;
            case "d":
            case "day":
            case "days":
                time += parseInt(parts[i], 10) * multipliers.day;
                break;
            case "w":
            case "wk":
            case "wks":
            case "week":
            case "weeks":
                time += parseInt(parts[i], 10) * multipliers.week;
                break;
            case "M":
            case "mo":
            case "mon":
            case "month":
            case "months":
                time += parseInt(parts[i], 10) * multipliers.month;
                break;
            case "y":
            case "yr":
            case "yrs":
            case "year":
            case "years":
                time += parseInt(parts[i], 10) * multipliers.year;
                break;
            default:
                return;
        }
    }

    return time;
}

const genUid = (n = 6) => Math.floor(Math.random() * 16 ** n).toString(16).padStart(n, "0");

function addReminder(duration: number, content: string, ctx: CommandInteraction | ModalSubmitInteraction, ephemeral = false): boolean {
    const currentReminders = [...reminders.get(ctx.user.id) || []];
    if (currentReminders.length >= 10) return false;
    let uid: string;
    while (true) {
        uid = genUid();
        if (currentReminders.every(r => r.uid !== uid)) break;
    }

    const reminder: RemindersItem[number] = {
        uid,
        at: Date.now() + duration * 1000,
        duration,
        content
    };
    if (client.guilds.has(ctx.guildID) && !ephemeral) {
        reminder.channelID = ctx.channelID;
        reminder.guildID = ctx.guildID;
    }
    currentReminders.push(reminder);
    reminders.set(ctx.user.id, currentReminders);

    return true;
}

client.on("interactionCreate", async ctx => {
    if (ctx.type === InteractionTypes.APPLICATION_COMMAND
        && ctx.data.type === ApplicationCommandTypes.MESSAGE
        && ctx.data.name === "Remind me later"
    ) {

        ctx.createModal({
            title: "Set a reminder",
            customID: `reminder-modal-${ctx.data.target.id}`,
            components: new ComponentBuilder<ModalActionRow>()
                .addTextInput({
                    label: "Remind me in",
                    customID: "duration",
                    style: TextInputStyles.SHORT,
                    required: true
                })
                .addTextInput({
                    label: "Add a note",
                    customID: "note",
                    style: TextInputStyles.PARAGRAPH,
                    maxLength: 1000,
                    required: false
                })
                .addTextInput({
                    label: "Hide from others? (type anything)",
                    customID: "ephemeral",
                    style: TextInputStyles.SHORT,
                    required: false
                })
                .toJSON()
        });

    } else if (ctx.type === InteractionTypes.MODAL_SUBMIT
        && ctx.data.customID.startsWith("reminder-modal")
    ) {
        const durString = ctx.data.components.getTextInput("duration", true);
        const duration = parseDate(durString);
        const note = ctx.data.components.getTextInput("note");
        const ephemeral = !!ctx.data.components.getTextInput("ephemeral");
        if (!duration) return ctx.reply({
            content: "Failed to parse date",
            flags: MessageFlags.EPHEMERAL
        });

        const messageID = ctx.data.customID.split("-").at(-1);
        const content = `https://discord.com/channels/${ctx.guildID}/${ctx.channelID}/${messageID} ` + note;

        const success = addReminder(duration, content, ctx, ephemeral);
        if (success) ctx.reply({
            content: `<t:${Math.floor(Date.now() / 1000 + duration) + 2}:R>: ${content}`,
            flags: ephemeral ? MessageFlags.EPHEMERAL : 0
        });
        else ctx.reply({
            content: "Failed to add reminder. This is most likely because you already have too many reminders.",
            flags: MessageFlags.EPHEMERAL
        });

    } else if (ctx.type === InteractionTypes.APPLICATION_COMMAND
        && ctx.data.type === ApplicationCommandTypes.CHAT_INPUT
        && ctx.data.name === "remindme"
    ) {
        const durString = ctx.data.options.getString("duration", true);
        const duration = parseDate(durString);
        const content = ctx.data.options.getString("content", true).slice(0, 1000);
        const ephemeral = ctx.data.options.getBoolean("ephemeral");
        if (!duration) return ctx.reply({
            content: "Failed to parse date",
            flags: MessageFlags.EPHEMERAL
        });

        const success = addReminder(duration, content, ctx, ephemeral);
        if (success) ctx.reply({
            content: `<t:${Math.floor(Date.now() / 1000 + duration) + 2}:R>: ${content}`,
            flags: ephemeral ? MessageFlags.EPHEMERAL : 0
        });
        else ctx.reply({
            content: "Failed to add reminder. This is most likely because you already have too many reminders.",
            flags: MessageFlags.EPHEMERAL
        });

    } else if (ctx.type === InteractionTypes.APPLICATION_COMMAND
        && ctx.data.type === ApplicationCommandTypes.CHAT_INPUT
        && ctx.data.name === "reminders"
    ) {
        const subcommand = ctx.data.options.getSubCommand(true);
        if (subcommand && subcommand[0] === "list") {
            const reminderList = reminders.get(ctx.user.id) || [];

            let content = reminderList.map(r => `\`${r.uid}\` (<t:${Math.floor(r.at / 1000)}:R>): ${r.content}`).join("\n");
            if (content.length >= 4096) {
                content = reminderList.map(r => `\`${r.uid}\` (<t:${Math.floor(r.at / 1000)}:R>)`).join("\n");
            }

            return ctx.reply({
                embeds: [new EmbedBuilder()
                    .setAuthor("Your reminders")
                    .setColor(0x89b4fa)
                    .setDescription(content
                        || "You don't have any reminders - set one with `/remindme`")
                    .toJSON()]
            });

        } else if (subcommand && subcommand[0] === "delete") {
            const id = ctx.data.options.getString("id", true);
            const reminderList = reminders.get(ctx.user.id) || [];
            const newReminderList = reminderList.filter(r => r.uid !== id);

            if (reminderList.length === newReminderList.length) {
                return ctx.reply({
                    content: "Couldn't find a reminder with that ID",
                    flags: MessageFlags.EPHEMERAL
                });
            }

            if (newReminderList.length > 0) {
                reminders.set(ctx.user.id, newReminderList);
            } else {
                reminders.delete(ctx.user.id);
            }

            return ctx.reply({
                content: "👍️",
                flags: MessageFlags.EPHEMERAL
            });
        }
    }
});
