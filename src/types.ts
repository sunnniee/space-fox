import type { Attachment, CommandInteraction, Message, Role, User, AnyInteractionChannel,
    ApplicationCommandOptionsWithValue,
    ApplicationCommandOptionTypes,
    ApplicationCommandTypes,
    AutocompleteInteraction,
    ComponentInteraction,
    ComponentTypes,
    CreateApplicationCommandOptions,
    CreateMessageOptions,
    ModalSubmitInteraction,
    Uncached } from "oceanic.js";
import type { PermissionTier } from "./permissions.ts";
import type { prompt } from "./utils/gemini.ts";

export type NonEmptyArray<T> = [T, ...T[]];
export interface BangResult {
    content: CreateMessageOptions | string;
    link?: string;
    afterSend?: (msg: Message<AnyInteractionChannel | Uncached>) => any;
}

export type Context = Message<AnyInteractionChannel | Uncached>
    | (CommandInteraction<AnyInteractionChannel | Uncached> & { author: User });

export enum ComponentHandlerTypes {
    MODAL,
    BUTTON,
    STRING_SELECT
}

export interface ButtonComponentHandler {
    match: RegExp;
    type: ComponentHandlerTypes.BUTTON;
    handle: (ctx: ComponentInteraction<ComponentTypes.BUTTON>) => Promise<any>;
}
export interface StringSelectComponentHandler {
    match: RegExp;
    type: ComponentHandlerTypes.STRING_SELECT;
    handle: (ctx: ComponentInteraction<ComponentTypes.STRING_SELECT>, value: string) => Promise<any>;
}

// TODO
// type ModalValues = string | string[] | User[] | InteractionResolvedChannel[] | (User | Role)[] | Attachment[];
export interface ModalComponentHandler {
    match: RegExp;
    type: ComponentHandlerTypes.MODAL;
    handle: (ctx: ModalSubmitInteraction, values: Record<string, any>) => Promise<any>;
}

export type ComponentHandler = ButtonComponentHandler | StringSelectComponentHandler | ModalComponentHandler;

export interface Bang {
    title: string;
    names: NonEmptyArray<string>;
    predicate?: () => boolean;
    ignoreIfBlank?: boolean;
    shortExecute?: boolean;
    takesParameters?: boolean;
    paramSuggestions?: Record<string, string>;
    exampleQueries?: string[];
    autocomplete?: (input?: string) => Promise<{ content: string; parameter?: string }[]>;
    restrict?: PermissionTier[];
    componentHandlers?: ComponentHandler[];
    execute: (content: string,
        attachments: Attachment[],
        ctx: Context,
        parameter?: string
    ) => Promise<BangResult>;
}

export interface PromptOptions {
    systemPrompt?: string;
    model?: string;
    imageGeneration?: boolean;
    history?: PromptHistoryItem[];
    reasoningBudget?: number;
}

export interface InlineData {
    mime_type: string;
    data: string;
}
export type PromptHistoryItemUserParts = { text: string }
    | { inline_data: InlineData }
    | { functionResponse: { name: string; response: any } };
export type PromptHistoryItemModelParts = { text: string }
    | { inline_data: InlineData }
    | { functionCall: { name: string; args: any } };
export type PromptHistoryItemParts = PromptHistoryItemUserParts | PromptHistoryItemModelParts;

export interface PromptHistoryUserItem {
    role: "user";
    parts: PromptHistoryItemUserParts[];
}
export interface PromptHistoryModelItem {
    role: "model";
    parts: PromptHistoryItemModelParts[];
}
export type PromptHistoryItem = PromptHistoryUserItem | PromptHistoryModelItem;

export interface PromptResult {
    response: {
        text: string;
        images: Buffer[];
    };
    history: PromptHistoryItem[];
}
export type PromptFunctions = Exclude<Parameters<typeof prompt>["2"], "all">;

export type RemindersItem = {
    uid: string;
    at: number;
    duration: number;
    content: string;
    guildID?: string;
    channelID?: string;
}[];

export interface OptionTypeMapping {
    [ApplicationCommandOptionTypes.STRING]: string;
    [ApplicationCommandOptionTypes.INTEGER]: number;
    [ApplicationCommandOptionTypes.NUMBER]: number;
    [ApplicationCommandOptionTypes.BOOLEAN]: boolean;
    [ApplicationCommandOptionTypes.USER]: User;
    [ApplicationCommandOptionTypes.CHANNEL]: AnyInteractionChannel;
    [ApplicationCommandOptionTypes.ROLE]: Role;
    [ApplicationCommandOptionTypes.MENTIONABLE]: User | Role;
    [ApplicationCommandOptionTypes.ATTACHMENT]: Attachment;
}

export type OptionsToArgs<T extends readonly ApplicationCommandOptionsWithValue[]> = {
    [K in keyof T]: T[K] extends ApplicationCommandOptionsWithValue
        ? T[K]["type"] extends keyof OptionTypeMapping
            ? T[K]["required"] extends false
                ? OptionTypeMapping[T[K]["type"]] | undefined
                : OptionTypeMapping[T[K]["type"]]
            : never
        : never
};

export type OptionsToObject<T extends readonly ApplicationCommandOptionsWithValue[]> =
    T extends readonly [infer First, ...infer Rest]
        ? First extends ApplicationCommandOptionsWithValue
            ? Rest extends readonly ApplicationCommandOptionsWithValue[]
                ? {
                    [K in First["name"]]: First["type"] extends keyof OptionTypeMapping
                        ? First["required"] extends false
                            ? OptionTypeMapping[First["type"]] | undefined
                            : OptionTypeMapping[First["type"]]
                        : never
                } & OptionsToObject<Rest>
                : never
            : never
        : Record<string, never>;

export interface ChatInputCommand<
    C extends typeof ApplicationCommandTypes.CHAT_INPUT,
    O extends readonly ApplicationCommandOptionsWithValue[]
> {
    name: string;
    type: C;
    description: string;
    predicate?: () => boolean;
    options?: O;
    execute: (ctx: CommandInteraction<AnyInteractionChannel | Uncached, C>,
        options: OptionsToObject<O>) => Promise<any>;
    componentHandlers?: ComponentHandler[];
    autocomplete?: (ctx: AutocompleteInteraction<AnyInteractionChannel | Uncached>,
        options: Partial<OptionsToObject<O>>) => Promise<any>;
}

export interface ContextMenuCommand<
    C extends typeof ApplicationCommandTypes.USER | typeof ApplicationCommandTypes.MESSAGE
> {
    name: string;
    type: C;
    predicate?: () => boolean;
    execute: (ctx: CommandInteraction<AnyInteractionChannel | Uncached, C>) => Promise<any>;
    componentHandlers?: ComponentHandler[];
}

export type Command<C extends ApplicationCommandTypes, O extends readonly ApplicationCommandOptionsWithValue[]> =
    C extends typeof ApplicationCommandTypes.CHAT_INPUT ? ChatInputCommand<C, O>
        : C extends typeof ApplicationCommandTypes.USER | typeof ApplicationCommandTypes.MESSAGE
            ? ContextMenuCommand<C>
            : never;

export type ExecuteFn = (...args: any[]) => Promise<any>;
export type CommandList = (CreateApplicationCommandOptions & {
    execute: Record<string | symbol, ExecuteFn>;
    componentHandlers: ComponentHandler[];
    autocomplete?: Record<string | symbol, ExecuteFn>;
})[];
