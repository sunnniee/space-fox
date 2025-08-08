import type { AnyTextableChannel, Message } from "oceanic.js";

import type { Bang, CommandList, ComponentHandler, PromptHistoryItem } from "./types.d.ts";

export const bangRegex = /(?:(.*)\s|^)!([\w-]+)$/si;

export const commands = [] as CommandList;
export const bangs: Record<string, Bang> = {};
export const allComponentHandlers: ComponentHandler[] = [];

export const bangInputs: Record<string, {
    message: Message<AnyTextableChannel>;
    at: number;
}> = {};

export const promptHistory: Record<string, {
    userId: string;
    history: PromptHistoryItem[];
    at: number;
}> = {};
