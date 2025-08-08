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
        readdir("./src/commands", (err, res) => {
            if (err) throw err;
            else res.forEach(f => import(`./commands/${f}`));
        });
        readdir("./src/events", (err, res) => {
            if (err) throw err;
            else res.forEach(f => import(`./events/${f}`));
        });
        checkReminders();
    }
});

client.connect();
