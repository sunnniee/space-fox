import { Attachment, CommandInteraction, Message, User } from "oceanic.js";
import type { AnyInteractionChannel, AnyTextableChannel, ApplicationCommandOptionsWithValue, ApplicationCommandOptionTypes, ApplicationCommandTypes, AutocompleteInteraction, ComponentInteraction, ComponentTypes, CreateApplicationCommandOptions, CreateMessageOptions, ModalSubmitInteraction, Uncached } from "oceanic.js";
import type { PermissionTier } from "./permissions.ts";

export type BangResult = {
    content: CreateMessageOptions | string;
    link?: string;
    afterSend?: (msg: Message<AnyTextableChannel>) => any;
};

export type Context = Message<AnyTextableChannel | Uncached> | (CommandInteraction<AnyInteractionChannel | Uncached> & { author: User });

export enum ComponentHandlerTypes {
    MODAL,
    BUTTON,
    STRING_SELECT
}

export type ButtonComponentHandler = {
    match: RegExp;
    type: ComponentHandlerTypes.BUTTON;
    handle: (ctx: ComponentInteraction<ComponentTypes.BUTTON>) => Promise<any>;
};
export type StringSelectComponentHandler = {
    match: RegExp;
    type: ComponentHandlerTypes.STRING_SELECT;
    handle: (ctx: ComponentInteraction<ComponentTypes.STRING_SELECT>, value: string) => Promise<any>;
};
export type ModalComponentHandler = {
    match: RegExp;
    type: ComponentHandlerTypes.MODAL;
    handle: (ctx: ModalSubmitInteraction, ...input: string[]) => Promise<any>;
};
export type ComponentHandler = ButtonComponentHandler | StringSelectComponentHandler | ModalComponentHandler;

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

export interface ChatInputCommand<C extends typeof ApplicationCommandTypes.CHAT_INPUT, O extends readonly ApplicationCommandOptionsWithValue[]> {
    name: string;
    type: C;
    description: string;
    globalDescription?: string;
    predicate?: () => boolean;
    options?: O;
    execute: (ctx: CommandInteraction<AnyInteractionChannel | Uncached>, ...args: OptionsToArgs<O>) => Promise<any>;
    componentHandlers?: ComponentHandler[];
    autocomplete?: (ctx: AutocompleteInteraction<AnyInteractionChannel | Uncached>, ...args: Partial<OptionsToArgs<O>>) => Promise<any>;
}

export interface ContextMenuCommand<C extends typeof ApplicationCommandTypes.USER | typeof ApplicationCommandTypes.MESSAGE> {
    name: string;
    type: C;
    predicate?: () => boolean;
    execute: (ctx: CommandInteraction<AnyInteractionChannel | Uncached, C>) => Promise<any>;
    componentHandlers?: ComponentHandler[];
}

/* eslint-disable stylistic/indent */
export type Command<C extends ApplicationCommandTypes, O extends readonly ApplicationCommandOptionsWithValue[]> =
    C extends typeof ApplicationCommandTypes.CHAT_INPUT ? ChatInputCommand<C, O>
    : C extends typeof ApplicationCommandTypes.USER | typeof ApplicationCommandTypes.MESSAGE ? ContextMenuCommand<C> : never;
/* eslint-enable stylistic/indent */

export type ExecuteFn = (...args: any[]) => Promise<any>;
export type CommandList = (CreateApplicationCommandOptions & {
    execute: ExecuteFn | Record<string, ExecuteFn>;
    componentHandlers: ComponentHandler[];
    autocomplete?: ExecuteFn | Record<string, ExecuteFn>;
})[];
