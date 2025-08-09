import { client } from "../client.ts";
import { allComponentHandlers, commands } from "../globals.ts";
import type { ComponentHandler, ModalComponentHandler } from "../types.js";

function isModalHandler(handler: ComponentHandler): handler is ModalComponentHandler {
    return "modal" in handler;
}

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
                    return cmd.execute[subcommand](ctx, ...input);
                // @ts-expect-error only an object if the command has subcommands
                else return cmd.execute(ctx, ...input);
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
        allComponentHandlers.forEach(handler => {
            if (handler.match.test(ctx.data.customID)) {
                if (isModalHandler(handler) && ctx.isModalSubmitInteraction())
                    return handler.handle(ctx, ...ctx.data.components.raw.flatMap(v => v.components.map(c => c.value)));
                // god typescript is dumb
                else if (!isModalHandler(handler) && ctx.isComponentInteraction())
                    return handler.handle(ctx);
            }
        });
    }
});
