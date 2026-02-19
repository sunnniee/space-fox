import { ApplicationCommandOptionTypes, ApplicationCommandTypes, ComponentTypes, MessageFlags, TextInputStyles } from "oceanic.js";
import type { ModalComponent } from "oceanic.js";
import { EmbedBuilder } from "@oceanicjs/builders";
import { ComponentHandlerTypes } from "../types.ts";
import { addReminder, parseDate, reminders, utcTzRegex, userTimezones } from "../utils/reminders.ts";
import { registerCommand } from "../utils/commands.ts";

registerCommand({
    name: "remindme",
    description: "Set a reminder",
    type: ApplicationCommandTypes.CHAT_INPUT,
    options: [{
        name: "when",
        description: "Duration of the reminder",
        type: ApplicationCommandOptionTypes.STRING,
        required: true
    }, {
        name: "about",
        description: "Content of the reminder",
        type: ApplicationCommandOptionTypes.STRING,
        required: true
    }, {
        name: "ephemeral",
        description: "Don't show others the reminder message",
        type: ApplicationCommandOptionTypes.BOOLEAN,
        required: false
    }],
    execute: async (ctx, { when: duration, about: content, ephemeral }) => {
        const result = parseDate(duration, ctx.user.id);
        if (!result || result.error) {
            return ctx.reply({
                content: result?.error || "Couldn't parse that time",
                flags: MessageFlags.EPHEMERAL
            });
        }

        const uid = addReminder(result.duration, content, ctx, ephemeral);
        if (uid) ctx.reply({
            content: `<t:${Math.floor(Date.now() / 1000 + result.duration) + 2}:R>: ${content}`,
            flags: ephemeral ? MessageFlags.EPHEMERAL : 0
        });
        else ctx.reply({
            content: "Failed to add reminder. You likely have too many active reminders (max 10)",
            flags: MessageFlags.EPHEMERAL
        });
    }
});

registerCommand({
    name: "Remind me later",
    type: ApplicationCommandTypes.MESSAGE,
    execute: async ctx => {
        const components = [
            {
                type: ComponentTypes.LABEL,
                label: "Remind me in",
                component: {
                    type: ComponentTypes.TEXT_INPUT,
                    customID: "duration",
                    style: TextInputStyles.SHORT,
                    required: true
                }
            },
            {
                type: ComponentTypes.LABEL,
                label: "Add a note",
                component: {
                    type: ComponentTypes.TEXT_INPUT,
                    customID: "note",
                    style: TextInputStyles.PARAGRAPH,
                    maxLength: 1000,
                    required: false
                }
            },
            {
                type: ComponentTypes.LABEL,
                label: "Reminder response",
                component: {
                    type: ComponentTypes.STRING_SELECT,
                    customID: "ephemeral",
                    options: [
                        { label: "Visible to everyone", value: "false" },
                        { label: "Hidden (ephemeral)", value: "true" }
                    ],
                    required: false
                }
            }
        ] satisfies ModalComponent[];

        ctx.createModal({
            title: "Set a reminder",
            customID: `reminder-modal-${ctx.data.target.id}`,
            components
        });
    },
    componentHandlers: [{
        match: /^reminder-modal-/,
        type: ComponentHandlerTypes.MODAL,
        handle: async (ctx, { duration: durString, note, ephemeral: eph }) => {
            const ephemeral = eph ? eph[0] === "true" : true;
            const result = parseDate(durString, ctx.user.id);

            if (!result || result.error) return ctx.reply({
                content: result?.error || "Couldn't parse that time",
                flags: MessageFlags.EPHEMERAL
            });

            const messageID = ctx.data.customID.split("-").at(-1);
            const content = `https://discord.com/channels/${ctx.guildID || "@me"}/${ctx.channelID}/${messageID} ` + note;

            const success = addReminder(result.duration, content, ctx, ephemeral);
            if (success) ctx.reply({
                content: `<t:${Math.floor(Date.now() / 1000 + result.duration) + 2}:R>: ${content}`,
                flags: ephemeral ? MessageFlags.EPHEMERAL : 0
            });
            else ctx.reply({
                content: "Failed to add reminder. You likely have too many active reminders (max 10)",
                flags: MessageFlags.EPHEMERAL
            });
        }
    }]
});

registerCommand({
    name: "reminders list",
    type: ApplicationCommandTypes.CHAT_INPUT,
    description: "List existing reminders",
    execute: async ctx => {
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
    }
});

registerCommand({
    name: "reminders delete",
    type: ApplicationCommandTypes.CHAT_INPUT,
    description: "Delete a reminder",
    options: [{
        name: "id",
        description: "Reminder ID",
        type: ApplicationCommandOptionTypes.STRING,
        required: true
    }],
    execute: async (ctx, { id }) => {
        const reminderList = reminders.get(ctx.user.id) || [];
        const newReminderList = reminderList.filter(r => r.uid !== id.trim());

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
});

registerCommand({
    name: "reminders timezone",
    type: ApplicationCommandTypes.CHAT_INPUT,
    description: "Set or check your timezone",
    options: [{
        name: "zone",
        description: "Timezone (like 'Europe/London' or 'UTC+2')",
        type: ApplicationCommandOptionTypes.STRING,
        required: false
    }],
    execute: async (ctx, { zone }) => {
        if (!zone) {
            const saved = userTimezones.get(ctx.user.id);
            return ctx.reply({
                content: saved
                    ? `Your timezone is set to \`${saved}\``
                    : "You haven't set a timezone yet",
                flags: MessageFlags.EPHEMERAL
            });
        }

        if (utcTzRegex.test(zone)) {
            userTimezones.set(ctx.user.id, zone.toUpperCase());
            return ctx.reply({
                content: `Timezone set to \`${zone.toUpperCase()}\``,
                flags: MessageFlags.EPHEMERAL
            });
        }

        try {
            Intl.DateTimeFormat(undefined, { timeZone: zone });
            userTimezones.set(ctx.user.id, zone);
            return ctx.reply({
                content: `Timezone set to \`${zone}\``,
                flags: MessageFlags.EPHEMERAL
            });
        } catch (err) {
            return ctx.reply({
                content: "Invalid timezone. Please use a valid [IANA code](<https://en.wikipedia.org/wiki/List_of_tz_database_time_zones#List>) \
(`Europe/London`, `America/New_York`) or a UTC offset (`UTC+2`, `GMT-5:30`)",
                flags: MessageFlags.EPHEMERAL
            });
        }
    }
});
