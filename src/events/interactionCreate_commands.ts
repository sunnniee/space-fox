import { ApplicationCommandOptionTypes, ComponentTypes, MessageFlags } from "oceanic.js";
import { client } from "../client.ts";
import { allComponentHandlers, commands } from "../globals.ts";
import { basicCommandExecute, handleError } from "../utils/commands.ts";
import { ComponentHandlerTypes } from "../types.ts";

client.on("interactionCreate", async ctx => {
    if (ctx.isCommandInteraction()) {
        commands.forEach(async cmd => {
            if (cmd.type === ctx.data.type && cmd.name === ctx.data.name) {
                const subcommandPath = ctx.data.options.getSubCommand(false);
                const subcommand = subcommandPath?.[0];

                let optionsToParse = ctx.data.options.raw;
                if (subcommand) {
                    const opt = optionsToParse.find(o => o.name === subcommand);
                    if (opt && "options" in opt)
                        optionsToParse = opt.options!;
                    else optionsToParse = [];
                }

                const input: Record<string, any> = {};
                for (const option of optionsToParse) {
                    if (option.type === ApplicationCommandOptionTypes.USER) {
                        input[option.name] = ctx.data.resolved.users.get(option.value);
                    } else if (option.type === ApplicationCommandOptionTypes.CHANNEL) {
                        input[option.name] = ctx.data.resolved.channels.get(option.value);
                    } else if (option.type === ApplicationCommandOptionTypes.ROLE) {
                        input[option.name] = ctx.data.resolved.roles.get(option.value);
                    } else if (option.type === ApplicationCommandOptionTypes.MENTIONABLE) {
                        input[option.name] = ctx.data.resolved.users.get(option.value)
                            ?? ctx.data.resolved.roles.get(option.value);
                    } else if (option.type === ApplicationCommandOptionTypes.ATTACHMENT) {
                        input[option.name] = ctx.data.resolved.attachments.get(option.value);
                    } else if ("value" in option) {
                        input[option.name] = option.value;
                    }
                }

                if (subcommand)
                    return await cmd.execute[subcommand]!(ctx, input)
                        .catch(e => handleError(ctx, e, MessageFlags.EPHEMERAL));
                else return await cmd.execute[basicCommandExecute]!(ctx, input)
                    .catch(e => handleError(ctx, e, MessageFlags.EPHEMERAL));
            }
        });
    } else if (ctx.isAutocompleteInteraction()) {
        commands.forEach(async cmd => {
            if (cmd.type === ctx.data.type && cmd.name === ctx.data.name && cmd.autocomplete) {
                const subcommandPath = ctx.data.options.getSubCommand(false);
                const subcommand = subcommandPath?.[0];

                let optionsToParse = ctx.data.options.raw;
                if (subcommand) {
                    const opt = optionsToParse.find(o => o.name === subcommand);
                    if (opt && "options" in opt)
                        optionsToParse = opt.options!;
                    else optionsToParse = [];
                }

                const input: Record<string, any> = {};
                for (const option of optionsToParse) {
                    if ("value" in option) {
                        input[option.name] = option.value;
                    }
                }

                if (subcommand)
                    return await cmd.autocomplete[subcommand]!(ctx, input);
                else return await cmd.autocomplete[basicCommandExecute]!(ctx, input);
            }
        });
    } else if (ctx.isModalSubmitInteraction()) {
        allComponentHandlers.forEach(async handler => {
            if (handler.type === ComponentHandlerTypes.MODAL && handler.match.test(ctx.data.customID)) {
                const inputFields = ctx.data.components.raw;
                const args: Record<string, any> = {};
                for (const field of inputFields) {
                    const input = "components" in field ? field.components[0]! : field.component;
                    if (!input.customID) continue;
                    if (input.type === ComponentTypes.TEXT_INPUT)
                        args[input.customID] = input.value;
                    else if (input.type === ComponentTypes.STRING_SELECT)
                        args[input.customID] = input.values;
                    else if (input.type === ComponentTypes.USER_SELECT)
                        args[input.customID] = input.values.map(v => ctx.data.resolved.users.get(v)!);
                    else if (input.type === ComponentTypes.CHANNEL_SELECT)
                        args[input.customID] = input.values.map(v => ctx.data.resolved.channels.get(v)!);
                    else if (input.type === ComponentTypes.ROLE_SELECT)
                        args[input.customID] = input.values.map(v => ctx.data.resolved.roles.get(v)!);
                    else if (input.type === ComponentTypes.MENTIONABLE_SELECT)
                        args[input.customID] = input.values.map(v => ctx.data.resolved.users.get(v)
                            ?? ctx.data.resolved.roles.get(v)!);
                    else if (input.type === ComponentTypes.FILE_UPLOAD)
                        args[input.customID] = input.values.map(v => ctx.data.resolved.attachments.get(v)!);
                }
                return await handler
                    .handle(ctx, args)
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
                    return await handler.handle(ctx, ctx.data.values.raw[0]!)
                        .catch(e => handleError(ctx, e, MessageFlags.EPHEMERAL));
                }
            }
        });
    }
});
