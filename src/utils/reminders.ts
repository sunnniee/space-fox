import { client } from "../client.ts";
import type { RemindersItem } from "../types.d.ts";
import { JSONDatabase } from "./database.ts";

export const reminders = new JSONDatabase<RemindersItem>("data/reminders.json");

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
            const reminderList = allReminders[userID];
            const remindersToSend = reminderList.filter(r => r.at <= Date.now());
            const remindersToKeep = reminderList.filter(r => r.at > Date.now());

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
