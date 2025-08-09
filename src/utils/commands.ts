import { ApplicationCommandOptionTypes, ApplicationCommandTypes, ApplicationIntegrationTypes, InteractionContextTypes } from "oceanic.js";
import type {
    ApplicationCommandOptionsWithOptions, ApplicationCommandOptionsWithValue,
    CreateApplicationCommandOptions, CreateChatInputApplicationCommandOptions
} from "oceanic.js";
import { allComponentHandlers, commands } from "../globals.ts";
import type { ChatInputCommand, Command } from "../types.js";

function isChatInputCommand(command: CreateApplicationCommandOptions): command is CreateChatInputApplicationCommandOptions;
function isChatInputCommand<T extends ApplicationCommandOptionsWithValue[]>(command: Command<T>): command is ChatInputCommand<T> {
    return command.type === ApplicationCommandTypes.CHAT_INPUT;
}

export function registerCommand<const T extends ApplicationCommandOptionsWithValue[]>(
    command: Command<T>
): void {
    const cmd = command as CreateApplicationCommandOptions;
    cmd.integrationTypes = [ApplicationIntegrationTypes.GUILD_INSTALL, ApplicationIntegrationTypes.USER_INSTALL];
    cmd.contexts = [InteractionContextTypes.BOT_DM, InteractionContextTypes.GUILD, InteractionContextTypes.PRIVATE_CHANNEL];
    let isSubcommand = false;

    if (isChatInputCommand(cmd) && isChatInputCommand(command) && command.globalDescription && command.name.includes(" ")) {
        cmd.description = command.globalDescription;
        isSubcommand = true;

        const [name, subcommand, extra] = command.name.split(" ");
        if (extra) return console.error("Invalid command name " + command.name);

        cmd.name = name;
        cmd.options = [{
            name: subcommand,
            description: command.description,
            type: ApplicationCommandOptionTypes.SUB_COMMAND,
            options: command.options
        }] satisfies ApplicationCommandOptionsWithOptions[];
    }

    const existingIndex = commands.findIndex(c => c.name === cmd.name);
    if (existingIndex !== -1) {
        if (!isSubcommand) return console.error("Duplicate command " + command.name);
        const existing = commands[existingIndex];
        if (!isChatInputCommand(cmd) || !isChatInputCommand(command) || !isChatInputCommand(existing)) return; // never

        existing.options.push(...cmd.options as ApplicationCommandOptionsWithOptions[]);
        if (typeof existing.execute === "function") existing.execute = {
            [existing.options[0].name]: existing.execute
        };
        existing.execute[cmd.options[0].name] = command.execute;

        if (command.autocomplete) {
            if (typeof existing.autocomplete === "function") existing.autocomplete = {
                [existing.options[0].name]: existing.autocomplete
            };
            existing.autocomplete[cmd.options[0].name] = command.autocomplete;
        }

        if (command.componentHandlers) {
            existing.componentHandlers.push(...command.componentHandlers);
            allComponentHandlers.push(...command.componentHandlers);
        }
        commands.splice(existingIndex, 1, existing);
    } else {
        commands.push(Object.assign(cmd, {
            execute: command.execute,
            componentHandlers: command.componentHandlers || []
        }));
        if (command.componentHandlers) allComponentHandlers.push(...command.componentHandlers);

    }
}
