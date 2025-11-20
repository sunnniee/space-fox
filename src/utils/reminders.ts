import type { CommandInteraction, ModalSubmitInteraction } from "oceanic.js";
import { client } from "../client.ts";
import type { RemindersItem } from "../types.ts";
import { JSONDatabase } from "./database.ts";

export const reminders = new JSONDatabase<RemindersItem>("data/reminders.json");
export const userTimezones = new JSONDatabase<string>("data/timezones.json");

export const utcTzRegex = /^(?:UTC|GMT)([+-])(\d{1,2})(?::(\d{2}))?$/i;

function parseDuration(date: string): number | void {
    date = date.replace(/M/g, "mo").toLowerCase();
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
        const val = parseInt(parts[i]!, 10);
        const unit = parts[i + 1]!.replace(/[^a-zA-Z]/g, "");

        let mult = 0;
        switch (unit) {
            case "s": case "sec": case "secs": case "second": case "seconds":
                mult = multipliers.second;
                break;
            case "m": case "min": case "mins": case "minute": case "minutes":
                mult = multipliers.minute;
                break;
            case "h": case "hr": case "hrs": case "hour": case "hours":
                mult = multipliers.hour;
                break;
            case "d": case "day": case "days":
                mult = multipliers.day;
                break;
            case "w": case "wk": case "wks": case "week": case "weeks":
                mult = multipliers.week;
                break;
            case "mo": case "mon": case "month": case "months":
                mult = multipliers.month;
                break;
            case "y": case "yr": case "yrs": case "year": case "years":
                mult = multipliers.year;
                break;
            default:
                return;
        }
        time += val * mult;
    }
    return time;
}

function getTzOffsetMinutes(tz: string, date = new Date()): number {
    const utcOffsetMatch = tz.match(utcTzRegex);
    if (utcOffsetMatch) {
        const sign = utcOffsetMatch[1] === "+" ? 1 : -1;
        const hours = parseInt(utcOffsetMatch[2]!, 10);
        const mins = utcOffsetMatch[3] ? parseInt(utcOffsetMatch[3], 10) : 0;
        return sign * (hours * 60 + mins);
    }

    const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC", hour12: false }));
    const tzDate = new Date(date.toLocaleString("en-US", { timeZone: tz, hour12: false }));
    return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

export function parseDate(input: string, userId: string): { duration: number; error?: string } | void {
    input = input.trim();

    const tmrRegex = /\b(tomorrow|tomorow|tommorow|tmr)\b/i;
    const isTomorrow = tmrRegex.test(input);
    input = input.replace(tmrRegex, "").trim();

    let addedSeconds = 0;

    // handle direct durations (ex. 2h and 6h30m)
    // and allow using them as offsets (3d 17:30 -> +3d, keeps 17:30)
    const durationPartRegex = /^((?:\d+\s*[a-zA-Z]+\s*)+)/;
    const durMatch = input.match(durationPartRegex);

    if (durMatch) {
        const durStr = durMatch[1]!;
        const parsed = parseDuration(durStr);
        if (parsed) {
            addedSeconds += parsed;
            input = input.slice(durStr.length).trim();
        }
    }

    // handle hard timestamps (17:30)
    const timeRegex = /^(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?$/i;
    const timeMatch = input.match(timeRegex);

    if (!timeMatch && !isTomorrow) {
        if (addedSeconds > 0 && input.length === 0) return { duration: addedSeconds };
        // treat single digits like "17" as hours, so let them fall through
        if (input.length > 0 && !/^\d+$/.test(input)) return;
    }

    const userTz = userTimezones.get(userId);
    if (!userTz) {
        return { duration: 0, error: "You must set your timezone first for that (`/reminders timezone`)" };
    }

    const now = new Date();
    const offsetMinutes = getTzOffsetMinutes(userTz, now);
    const userWallTime = new Date(now.getTime() + offsetMinutes * 60000);

    const targetTime = new Date(userWallTime);
    if (timeMatch) {
        let hours = parseInt(timeMatch[1]!, 10);
        const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

        const meridiem = timeMatch[3]?.toLowerCase();
        if (meridiem === "pm" && hours < 12) hours += 12;
        if (meridiem === "am" && hours === 12) hours = 0;

        if (hours > 23 || mins > 59) return;
        targetTime.setUTCHours(hours, mins, 0, 0);

        const isPastToday = (hours < userWallTime.getUTCHours())
            || (hours === userWallTime.getUTCHours() && mins <= userWallTime.getUTCMinutes());
        if (isPastToday || isTomorrow) {
            targetTime.setUTCDate(targetTime.getUTCDate() + 1);
        }
    } else if (isTomorrow) {
        // "tomorrow" + no specific time -> 24 hours from now
        targetTime.setUTCDate(targetTime.getUTCDate() + 1);
    }

    const targetUTC = new Date(targetTime.getTime() - offsetMinutes * 60000);
    const totalDuration = (targetUTC.getTime() - now.getTime()) / 1000 + addedSeconds;
    return { duration: totalDuration };
}

const genUid = (n = 6) => Math.floor(Math.random() * 16 ** n).toString(16).padStart(n, "0");

export function addReminder(duration: number,
    content: string,
    ctx: CommandInteraction | ModalSubmitInteraction,
    ephemeral = false) {
    const currentReminders = [...reminders.get(ctx.user.id) || []];
    if (currentReminders.length >= 10) return;
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
    if (ctx.guildID && client.guilds.has(ctx.guildID) && !ephemeral) {
        reminder.channelID = ctx.channelID;
        reminder.guildID = ctx.guildID;
    }
    currentReminders.push(reminder);
    reminders.set(ctx.user.id, currentReminders);

    return uid;
}

async function sendReminder(userID: string, reminder: RemindersItem[number]) {
    try {
        if (reminder.channelID && reminder.guildID) {
            client.sendMessage(reminder.channelID, {
                content: `<@${userID}> <t:${Math.floor(Date.now() / 1000 - reminder.duration)}:R>: ${reminder.content}`,
                allowedMentions: { users: true }
            }).catch(() => { });
        } else {
            const dm = await client.rest.users.createDM(userID);

            dm.createMessage({
                content: `<t:${Math.floor(Date.now() / 1000 - reminder.duration)}:R>: ${reminder.content}`,
                allowedMentions: { users: true }
            }).catch(() => { });
        }
    } catch (e) { }
}

export function checkReminders() {
    setInterval(async () => {
        const allReminders = reminders.getAll();

        for (const userID in allReminders) {
            const reminderList = allReminders[userID]!;
            const remindersToSend = reminderList.filter(r => r.at <= Date.now());
            const remindersToKeep = reminderList.filter(r => r.at > Date.now());
            if (remindersToSend.length === 0) continue;

            for (const reminder of remindersToSend) {
                await sendReminder(userID, reminder);
            }
            if (remindersToKeep.length > 0) {
                reminders.set(userID, remindersToKeep);
            } else {
                reminders.delete(userID);
            }
        }
    }, 2000);
}
