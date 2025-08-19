import { MessageFlags } from "oceanic.js";
import { client } from "../client.ts";
import { allComponentHandlers, commands } from "../globals.ts";
import { handleError } from "../utils/commands.ts";

client.on("interactionCreate", async ctx => {
    if (ctx.isCommandInteraction()) {
        commands.forEach(cmd => {
            if (cmd.type === ctx.data.type && cmd.name === ctx.data.name) {
                const subcommand = ctx.data.options.getSubCommand()?.[0];
                // TODO: make typescript happy properly
                const input = ctx.data.options.raw.flatMap((v: any) => {
                    if (subcommand) return v.options.map(o => o.value);
                    else return v.value;
                });

                if (subcommand)
                    return cmd.execute[subcommand](ctx, ...input).catch(e => handleError(ctx, e, MessageFlags.EPHEMERAL));
                // @ts-expect-error only an object if the command has subcommands
                else return cmd.execute(ctx, ...input).catch(e => handleError(ctx, e, MessageFlags.EPHEMERAL));
            }
        });
    } else if (ctx.isAutocompleteInteraction()) {
        commands.forEach(cmd => {
            if (cmd.type === ctx.data.type && cmd.name === ctx.data.name) {
                const subcommand = ctx.data.options.getSubCommand();
                const input = ctx.data.options.raw.flatMap((v: any) => {
                    if (subcommand) return v.options.map(o => o.value);
                    else return v.value;
                });

                if (subcommand?.[0])
                    return cmd.autocomplete[subcommand[0]](ctx, ...input);
                // @ts-expect-error only an object if the command has subcommands
                else return cmd.autocomplete(ctx, ...input);
            }
        });
    } else if (ctx.isComponentInteraction() || ctx.isModalSubmitInteraction()) {
        allComponentHandlers.forEach(async handler => {
            if (handler.match.test(ctx.data.customID)) {
                if (handler.type === "modal" && ctx.isModalSubmitInteraction())
                    try {
                        return await handler.handle(ctx, ...ctx.data.components.raw.flatMap(v => v.components.map(c => c.value)));
                    } catch (e) {
                        return handleError(ctx, e, MessageFlags.EPHEMERAL);
                    }
                // god typescript is dumb
                else if (handler.type === "message" && ctx.isComponentInteraction())
                    try {
                        return await handler.handle(ctx);
                    } catch (e) {
                        return handleError(ctx, e, MessageFlags.EPHEMERAL);
                    }
            }
        });
    }
});
