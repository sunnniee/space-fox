import { MessageFlags } from "oceanic.js";
import { client } from "../client.ts";
import { allComponentHandlers, commands } from "../globals.ts";
import { basicCommandExecute, handleError } from "../utils/commands.ts";
import { ComponentHandlerTypes } from "../types.ts";

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
                    return cmd.execute[subcommand](ctx, ...input)
                        .catch(e => handleError(ctx, e, MessageFlags.EPHEMERAL));
                else return cmd.execute[basicCommandExecute](ctx, ...input)
                    .catch(e => handleError(ctx, e, MessageFlags.EPHEMERAL));
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
                else return cmd.autocomplete[basicCommandExecute](ctx, ...input);
            }
        });
    } else if (ctx.isComponentInteraction() || ctx.isModalSubmitInteraction()) {
        allComponentHandlers.forEach(async handler => {
            if (handler.match.test(ctx.data.customID)) {
                if (handler.type === ComponentHandlerTypes.MODAL && ctx.isModalSubmitInteraction())
                    try {
                        return await handler
                            .handle(ctx, ...ctx.data.components.raw.flatMap(v => v.components.map(c => c.value)));
                    } catch (e) {
                        return handleError(ctx, e, MessageFlags.EPHEMERAL);
                    }
                else if (handler.type === ComponentHandlerTypes.BUTTON
                    && ctx.isComponentInteraction()
                    && ctx.isButtonComponentInteraction())
                    try {
                        return await handler.handle(ctx);
                    } catch (e) {
                        return handleError(ctx, e, MessageFlags.EPHEMERAL);
                    }
                else if (handler.type === ComponentHandlerTypes.STRING_SELECT
                    && ctx.isComponentInteraction()
                    && ctx.isSelectMenuComponentInteraction())
                    try {
                        // @ts-expect-error it's ignoring the type guard for some reason?
                        return await handler.handle(ctx, ctx.data.values.raw[0]);
                    } catch (e) {
                        return handleError(ctx, e, MessageFlags.EPHEMERAL);
                    }
            }
        });
    }
});
