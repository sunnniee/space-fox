import { AnyInteractionChannel, AnyTextableChannel, Attachment, CommandInteraction, CreateMessageOptions, Message, User } from "oceanic.js";
import type { ApplicationCommandOptionsWithValue, ApplicationCommandOptionTypes, ApplicationCommandTypes, AutocompleteInteraction, ComponentInteraction, CreateApplicationCommandOptions, ModalSubmitInteraction, Uncached } from "oceanic.js";
import type { PermissionTier } from "./permissions.ts";

export type BangResult = {
    content: CreateMessageOptions | string;
    link?: string;
    afterSend?: (msg: Message<AnyTextableChannel>) => any;
};

export type Context = Message<AnyTextableChannel | Uncached> | (CommandInteraction<AnyInteractionChannel | Uncached> & { author: User });

export type ComponentHandler = {
    match: RegExp;
    handle: (ctx: ComponentInteraction | ModalSubmitInteraction) => Promise<any>;
};

export type Bang = {
    title: string;
    names: string[];
    predicate?: () => boolean;
    ignoreIfBlank?: boolean;
    shortExecute?: boolean;
    takesParameters?: boolean;
    paramSuggestions?: Record<string, string>;
    exampleQueries?: string[];
    restrict?: PermissionTier[];
    componentHandlers?: ComponentHandler[];
    execute: (content: string,
        attachments: Attachment[],
        ctx: Context,
        parameter?: string
    ) => Promise<BangResult>;
};

export type PromptOptions = {
    systemPrompt?: string;
    maxLength?: number;
    model?: string;
    imageGeneration?: boolean;
    history?: PromptHistoryItem[];
};

export type InlineData = {
    mime_type: string;
    data: string;
};
export type PromptHistoryItem = {
    role: "user" | "model";
    parts: ({ text: string }
        | { inline_data: InlineData }
        | { functionCall: { name: string; args: any } }
        | { functionResponse: { name: string; response: any } })[];
};
export type PromptResult = {
    response: {
        text: string;
        images: Buffer[];
    };
    history: PromptHistoryItem[];
};

export type RemindersItem = {
    uid: string;
    at: number;
    duration: number;
    content: string;
    guildID?: string;
    channelID?: string;
}[];

export type OptionTypeMapping = {
    [ApplicationCommandOptionTypes.STRING]: string;
    [ApplicationCommandOptionTypes.INTEGER]: number;
    [ApplicationCommandOptionTypes.NUMBER]: number;
    [ApplicationCommandOptionTypes.BOOLEAN]: boolean;
};

/* eslint-disable stylistic/indent */
export type OptionsToArgs<T extends readonly ApplicationCommandOptionsWithValue[]> = {
    [K in keyof T]: T[K] extends ApplicationCommandOptionsWithValue
    ? T[K]["type"] extends keyof OptionTypeMapping
    ? T[K]["required"] extends false
    ? OptionTypeMapping[T[K]["type"]] | undefined
    : OptionTypeMapping[T[K]["type"]]
    : never
    : never
};
/* eslint-enable stylistic/indent */

export interface ChatInputCommand<T extends readonly ApplicationCommandOptionsWithValue[]> {
    name: string;
    type: typeof ApplicationCommandTypes.CHAT_INPUT;
    description: string;
    globalDescription?: string;
    options?: T;
    execute: (ctx: CommandInteraction<AnyInteractionChannel | Uncached>, ...args: OptionsToArgs<T>) => Promise<any>;
    componentHandlers?: ComponentHandler[];
    autocomplete?: (ctx: AutocompleteInteraction<AnyInteractionChannel | Uncached>, ...args: Partial<OptionsToArgs<T>>) => Promise<any>;
}

export interface ContextMenuCommand {
    name: string;
    type: typeof ApplicationCommandTypes.USER | typeof ApplicationCommandTypes.MESSAGE;
    execute: (ctx: CommandInteraction<AnyInteractionChannel | Uncached>) => Promise<any>;
    componentHandlers?: ComponentHandler[];
}

export type Command<T extends readonly ApplicationCommandOptionsWithValue[]> = ChatInputCommand<T> | ContextMenuCommand;

export type ExecuteFn = (...args: any[]) => Promise<any>;
export type CommandList = (CreateApplicationCommandOptions & {
    execute: ExecuteFn | Record<string, ExecuteFn>;
    componentHandlers: ComponentHandler[];
    autocomplete?: ExecuteFn | Record<string, ExecuteFn>;
})[];
