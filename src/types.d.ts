import { AnyInteractionChannel, AnyTextableChannel, Attachment, CommandInteraction, CreateMessageOptions, Message, User } from "oceanic.js";
import type { ComponentInteraction, Uncached } from "oceanic.js";
import type { PermissionTier } from "./permissions.ts";

export type BangResult = {
    content: CreateMessageOptions | string;
    link?: string;
    afterSend?: (msg: Message<AnyTextableChannel>) => any;
};

export type Context = Message<AnyTextableChannel | Uncached> | (CommandInteraction<AnyInteractionChannel | Uncached> & { author: User });

export type ComponentHandler = {
    match: RegExp;
    handle: (ctx: ComponentInteraction) => Promise<any>;
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
