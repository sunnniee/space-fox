import { readdir } from "fs";
// dotenv init is in client.ts

import { client } from "./client.ts";
import { commands } from "./globals.ts";

client.on("ready", () => {
    readdir("./src/commands", (err, res) => {
        if (err) throw err;
        else res.forEach(f => import(`./commands/${f}`));
    });

    // horrible
    setTimeout(async () => {
        await client.application.bulkEditGlobalCommands(commands.map(c => {
            const cmd = { ...c };
            delete cmd.execute;
            delete cmd.componentHandlers;
            delete cmd.autocomplete;
            return cmd;
        }));
        process.exit(0);
    }, 500);
});

client.connect();
