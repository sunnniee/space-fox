import { ComponentTypes, MessageFlags } from "oceanic.js";
import { client } from "../client.ts";
import { allComponentHandlers, commands } from "../globals.ts";
import { basicCommandExecute, handleError } from "../utils/commands.ts";
import { ComponentHandlerTypes } from "../types.ts";

client.on("interactionCreate", async ctx => {
    if (ctx.isCommandInteraction()) {
        commands.forEach(async cmd => {
            if (cmd.type === ctx.data.type && cmd.name === ctx.data.name) {
                const subcommand = ctx.data.options.getSubCommand()?.[0];
                const input = ctx.data.options.raw.flatMap(v => {
                    if (subcommand) {
                        if ("options" in v && v.options) {
                            return v.options.map(o => "value" in o ? o.value : null);
                        }
                        return [];
                    }
                    if ("value" in v) {
                        return v.value;
                    }
                    return [];
                }).filter(v => v !== null);

                if (subcommand)
                    return await cmd.execute[subcommand](ctx, ...input)
                        .catch(e => handleError(ctx, e, MessageFlags.EPHEMERAL));
                else return await cmd.execute[basicCommandExecute](ctx, ...input)
                    .catch(e => handleError(ctx, e, MessageFlags.EPHEMERAL));
            }
        });
    } else if (ctx.isAutocompleteInteraction()) {
        commands.forEach(async cmd => {
            if (cmd.type === ctx.data.type && cmd.name === ctx.data.name) {
                const subcommand = ctx.data.options.getSubCommand();
                const input = ctx.data.options.raw.flatMap(v => {
                    if (subcommand) {
                        if ("options" in v && v.options) {
                            return v.options.map(o => "value" in o ? o.value : null);
                        }
                        return [];
                    }
                    if ("value" in v) {
                        return v.value;
                    }
                    return [];
                }).filter(v => v !== null);

                if (subcommand?.[0])
                    return await cmd.autocomplete[subcommand[0]](ctx, ...input);
                else return await cmd.autocomplete[basicCommandExecute](ctx, ...input);
            }
        });
    } else if (ctx.isModalSubmitInteraction()) {
        allComponentHandlers.forEach(async handler => {
            if (handler.type === ComponentHandlerTypes.MODAL && handler.match.test(ctx.data.customID)) {
                return await handler
                    .handle(ctx, ...ctx.data.components.raw.flatMap(v => v.components.map(c => c.value)))
                    .catch(e => handleError(ctx, e, MessageFlags.EPHEMERAL));
            }
        });
    } else if (ctx.isComponentInteraction()) {
        allComponentHandlers.forEach(async handler => {
            if (handler.match.test(ctx.data.customID)) {
                if (handler.type === ComponentHandlerTypes.BUTTON && ctx.isButtonComponentInteraction()) {
                    return await handler.handle(ctx)
                        .catch(e => handleError(ctx, e, MessageFlags.EPHEMERAL));
                } else if (
                    handler.type === ComponentHandlerTypes.STRING_SELECT
                    && ctx.isSelectMenuComponentInteraction()
                    && ctx.data.componentType === ComponentTypes.STRING_SELECT
                ) {
                    return await handler.handle(ctx, ctx.data.values.raw[0])
                        .catch(e => handleError(ctx, e, MessageFlags.EPHEMERAL));
                }
            }
        });
    }
});
