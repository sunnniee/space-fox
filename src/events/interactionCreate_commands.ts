import { InteractionTypes } from "oceanic.js";
import { client } from "../client.ts";
import { allComponentHandlers, commands } from "../globals.ts";

client.on("interactionCreate", async ctx => {
    if (ctx.type === InteractionTypes.APPLICATION_COMMAND) {
        commands.forEach(cmd => {
            if (cmd.type === ctx.data.type && cmd.name === ctx.data.name) {
                const subcommand = ctx.data.options.getSubCommand();
                if (subcommand?.[0])
                    return cmd.execute[subcommand[0]](ctx, ...ctx.data.options.raw);
                // @ts-expect-error only an object if the command has subcommands
                else return cmd.execute(ctx, ...ctx.data.options.raw.map(v => v.value));
            }
        });
    } else if (ctx.type === InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE) {
        commands.forEach(cmd => {
            if (cmd.type === ctx.data.type && cmd.name === ctx.data.name) {
                const subcommand = ctx.data.options.getSubCommand();
                if (subcommand?.[0])
                    return cmd.autocomplete[subcommand[0]](ctx, ...ctx.data.options.raw);
                // @ts-expect-error only an object if the command has subcommands
                else return cmd.autocomplete(ctx, ...ctx.data.options.raw.map(v => v.value));
            }
        });
    } else if (ctx.type === InteractionTypes.MESSAGE_COMPONENT || ctx.type === InteractionTypes.MODAL_SUBMIT) {
        allComponentHandlers.forEach(handler => {
            if (handler.match.test(ctx.data.customID))
                return handler.handle(ctx);
        });
    }
});
