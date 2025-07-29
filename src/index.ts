import { readdir } from "fs";
// dotenv init is in client.ts

import { client } from "./client.ts";
import { checkReminders } from "./utils/reminders.ts";

let init = false;

client.on("ready", () => {
    console.log("Ready as", client.user.tag);

    if (!init) {
        init = true;

        readdir("./src/bangs", (err, res) => {
            if (err) throw err;
            else res.forEach(f => import(`./bangs/${f}`));
        });
        readdir("./src/events", (err, res) => {
            if (err) throw err;
            else res.forEach(f => import(`./events/${f}`));
        });
        checkReminders();
    }
});

client.connect();

/* only run once preferably
await client.application.createGlobalCommand({ name: "bang", integrationTypes: [0, 1], contexts: [0, 1, 2], description: "Run a bang (use !h for a list of bangs)", type: 1, options: [{ name: "content", description: "The text to send", required: true, type: 3, autocomplete: true }, { name: "ephemeral", description: "Send the response only to yourself", type: 5, required: false }] });
await client.application.createGlobalCommand({ name: "Use as bang input", type: 3, integrationTypes: [0, 1], contexts: [0, 1, 2] });
await client.application.createGlobalCommand({ name: "remindme", integrationTypes: [0, 1], contexts: [0, 1, 2], description: "Set a reminder", type: 1, options: [{ name: "duration", description: "Duration of the reminder", required: true, type: 3 }, { name: "content", description: "Content of the reminder", required: true, type: 3 }] });
await client.application.createGlobalCommand({ name: "reminders", integrationTypes: [0, 1], contexts: [0, 1, 2], description: "Set a reminder", type: 1, options: [{ name: "list", description: "List existing reminders", type: 1 }, { name: "delete", description: "Delete a reminder", type: 1, options: [{ name: "id", description: "Reminder ID", type: 3, required: true }] }] });
await client.application.createGlobalCommand({ name: "Remind me later", type: 3, integrationTypes: [0, 1], contexts: [0, 1, 2] });
await client.application.createGlobalCommand({ name: "@grok is this true", type: 3, integrationTypes: [0, 1], contexts: [0, 1, 2] });
*/
