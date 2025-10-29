import { ApplicationCommandOptionTypes, ApplicationCommandTypes, ApplicationIntegrationTypes, InteractionContextTypes } from "oceanic.js";
import type {
    ApplicationCommandOptionsWithOptions, ApplicationCommandOptionsWithValue,
    CommandInteraction,
    ComponentInteraction,
    CreateApplicationCommandOptions, CreateChatInputApplicationCommandOptions,
    ModalSubmitInteraction
} from "oceanic.js";
import { allComponentHandlers, commands } from "../globals.ts";
import type { Command } from "../types.js";

export const basicCommandExecute = Symbol("basicCommandExecute");

function isChatInputCommand<O extends readonly ApplicationCommandOptionsWithValue[]>(
    command: Command<ApplicationCommandTypes, O>
): command is Command<ApplicationCommandTypes.CHAT_INPUT, O> {
    return command.type === ApplicationCommandTypes.CHAT_INPUT;
}
function isChatInputCommandOptions(command: CreateApplicationCommandOptions):
    command is CreateChatInputApplicationCommandOptions {
    return command.type === ApplicationCommandTypes.CHAT_INPUT;
}

export function registerCommand<
    const O extends readonly ApplicationCommandOptionsWithValue[]
>(
    command: Command<ApplicationCommandTypes, O>
): void {
    if (command.predicate && !command.predicate()) {
        if (!process.env.SUPPRESS_WARNINGS) console.warn(`Skipping command ${command.name} as predicate failed`);
        return;
    }
    const cmd: CreateApplicationCommandOptions = isChatInputCommand(command)
        ? {
            type: command.type,
            name: command.name,
            description: command.description,
            options: command.options ? [...command.options] : undefined,
            integrationTypes: [ApplicationIntegrationTypes.GUILD_INSTALL, ApplicationIntegrationTypes.USER_INSTALL],
            contexts: [
                InteractionContextTypes.BOT_DM,
                InteractionContextTypes.GUILD,
                InteractionContextTypes.PRIVATE_CHANNEL
            ]
        }
        : {
            type: command.type,
            name: command.name,
            integrationTypes: [ApplicationIntegrationTypes.GUILD_INSTALL, ApplicationIntegrationTypes.USER_INSTALL],
            contexts: [
                InteractionContextTypes.BOT_DM,
                InteractionContextTypes.GUILD,
                InteractionContextTypes.PRIVATE_CHANNEL
            ]
        };

    let isSubcommand = false;

    if (isChatInputCommand(command) && isChatInputCommandOptions(cmd) && command.name.includes(" ")) {
        isSubcommand = true;

        const [name, subcommand, extra] = command.name.split(" ");
        if (extra) return console.error("Invalid command name " + command.name);

        cmd.name = name!;
        cmd.options = [{
            name: subcommand!,
            description: command.description,
            type: ApplicationCommandOptionTypes.SUB_COMMAND,
            options: command.options ? [...command.options] : undefined
        }] satisfies ApplicationCommandOptionsWithOptions[];
    }

    const existingIndex = commands.findIndex(c => c.name === cmd.name);
    if (existingIndex !== -1) {
        if (!isSubcommand) return console.error("Duplicate command " + command.name);
        const existing = commands[existingIndex]!;
        if (!isChatInputCommandOptions(cmd)
            || !isChatInputCommand(command)
            || !isChatInputCommandOptions(existing)
            || !cmd.options?.[0]
            || !existing.options?.[0]) return; // never

        existing.options.push(...cmd.options as ApplicationCommandOptionsWithOptions[]);

        if (existing.execute[basicCommandExecute]) {
            existing.execute[existing.options[0].name] = existing.execute[basicCommandExecute];
            delete existing.execute[basicCommandExecute];
        }
        existing.execute[cmd.options[0].name] = command.execute;

        if (command.autocomplete && existing.autocomplete) {
            if (existing.autocomplete[basicCommandExecute]) {
                existing.autocomplete[existing.options[0].name] = existing.autocomplete[basicCommandExecute];
                delete existing.autocomplete[basicCommandExecute];
            }
            existing.autocomplete[cmd.options[0].name] = command.autocomplete;
        }

        if (command.componentHandlers) {
            existing.componentHandlers.push(...command.componentHandlers);
            allComponentHandlers.push(...command.componentHandlers);
        }
        commands.splice(existingIndex, 1, existing);
    } else {
        const newCommand: typeof commands[0] = {
            ...cmd,
            execute: { [basicCommandExecute]: command.execute },
            componentHandlers: command.componentHandlers || []
        };

        if (isChatInputCommand(command) && command.autocomplete) {
            newCommand.autocomplete = { [basicCommandExecute]: command.autocomplete };
        }

        commands.push(newCommand);
        if (command.componentHandlers?.length) allComponentHandlers.push(...command.componentHandlers);
    }
}

export function handleError(ctx: CommandInteraction | ModalSubmitInteraction | ComponentInteraction,
    e: any,
    ephemeralFlag?: number) {
    if (!process.env.SUPPRESS_WARNINGS) console.log(e);
    let error = "Unknown error";
    try {
        error = e.toString()
            .replace(/https?:\/\/[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()!@:%_+.~#?&//=]*)/g, "[link]")
            .replace(/\/webhooks\/\d+\/\w+/g, "/[redacted]");
    } catch { }
    ctx.reply({
        content: `Something went wrong while running that, oop\n\`\`\`${error}\`\`\``,
        flags: ephemeralFlag || 0
    }).catch(() => { });
}
