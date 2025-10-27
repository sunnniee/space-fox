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

function isChatInputCommand<
    C extends ApplicationCommandTypes,
    O extends readonly ApplicationCommandOptionsWithValue[]
// @ts-expect-error Type 'Command<ApplicationCommandTypes.CHAT_INPUT, O>' is not assignable to type 'Command<C, O>'.
>(command: Command<C, O>): command is Command<typeof ApplicationCommandTypes.CHAT_INPUT, O> {
    return command.type === ApplicationCommandTypes.CHAT_INPUT;
}
function isChatInputCommandOptions(command: CreateApplicationCommandOptions):
    command is CreateChatInputApplicationCommandOptions {
    return command.type === ApplicationCommandTypes.CHAT_INPUT;
}

export function registerCommand<
    const C extends ApplicationCommandTypes,
    const O extends readonly ApplicationCommandOptionsWithValue[]
>(
    command: Command<C, O>
): void {
    if (command.predicate && !command.predicate()) {
        if (!process.env.SUPPRESS_WARNINGS) console.warn(`Skipping command ${command.name} as predicate failed`);
        return;
    }
    const cmd = command as CreateApplicationCommandOptions;
    cmd.integrationTypes = [ApplicationIntegrationTypes.GUILD_INSTALL, ApplicationIntegrationTypes.USER_INSTALL];
    cmd.contexts = [InteractionContextTypes.BOT_DM,
        InteractionContextTypes.GUILD,
        InteractionContextTypes.PRIVATE_CHANNEL];
    let isSubcommand = false;

    if (isChatInputCommandOptions(cmd)
        && isChatInputCommand(command)
        && command.name.includes(" ")) {
        isSubcommand = true;

        const [name, subcommand, extra] = command.name.split(" ");
        if (extra) return console.error("Invalid command name " + command.name);

        cmd.name = name;
        // @ts-expect-error always fine for a subcommand
        cmd.options = [{
            name: subcommand,
            description: command.description,
            type: ApplicationCommandOptionTypes.SUB_COMMAND,
            // @ts-expect-error always fine for a subcommand
            options: command.options
        }] satisfies ApplicationCommandOptionsWithOptions[];
    }

    const existingIndex = commands.findIndex(c => c.name === cmd.name);
    if (existingIndex !== -1) {
        if (!isSubcommand) return console.error("Duplicate command " + command.name);
        const existing = commands[existingIndex];
        if (!isChatInputCommandOptions(cmd)
            || !isChatInputCommand(command)
            || !isChatInputCommandOptions(existing)) return; // never

        existing.options.push(...cmd.options as ApplicationCommandOptionsWithOptions[]);

        if (existing.execute[basicCommandExecute]) {
            existing.execute[existing.options[0].name] = existing.execute[basicCommandExecute];
            delete existing.execute[basicCommandExecute];
        }
        existing.execute[cmd.options[0].name] = command.execute;

        if (command.autocomplete) {
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
        const newCommand = command as unknown as typeof commands[0];
        newCommand.execute = { [basicCommandExecute]: command.execute };
        if (isChatInputCommandOptions(cmd) && isChatInputCommand(command) && newCommand.autocomplete)
            newCommand.autocomplete = { [basicCommandExecute]: command.autocomplete };

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
