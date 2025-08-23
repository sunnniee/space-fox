import { ButtonStyles, ComponentTypes } from "oceanic.js";
import type { CreateMessageOptions } from "oceanic.js";

import { allComponentHandlers, bangs } from "../globals.ts";
import { getPermissionTier } from "../permissions.ts";
import type { Bang } from "../types.js";

let titleList = {} as Record<string, string[]>;
let setTitleList = false;

const exampleList = {} as Record<string, { name: string; examples: string[] }>;
let setExampleList = false;

export function bangsByTitle() {
    if (!setTitleList) {
        Object.entries(bangs).forEach(([name, bang]) => {
            if (!titleList[bang.title]) titleList[bang.title] = [name];
            else titleList[bang.title].push(name);
        });
        setTitleList = true;
        titleList = Object.fromEntries(Object.entries(titleList).sort(([n1], [n2]) => n1 < n2 ? -1 : 1));
    }
    return titleList;
}

export function getBangExamples(maxCount = 3) {
    if (!setExampleList) {
        Object.values(bangs).forEach(bang => {
            if (exampleList[bang.title] || !bang.exampleQueries) return;
            exampleList[bang.title] = {
                name: bang.names[0],
                examples: bang.exampleQueries
            };
        });
        setExampleList = true;
    }

    const entries = Object.entries(exampleList);
    for (let i = entries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [entries[i], entries[j]] = [entries[j], entries[i]];
    }

    return entries.slice(0, maxCount).map(v => {
        const randExample = Math.floor(Math.random() * v[1].examples.length);
        return {
            name: `${v[1].examples[randExample]} !${v[1].name} (${v[0]})`,
            value: `${v[1].examples[randExample]} !${v[1].name}`
        };
    });
}

export function canUseBang(bangName: string, user: { id: string }, guild?: { id: string }) {
    const bang = bangs[bangName];
    if (!bang.restrict) return true;
    const tier = getPermissionTier(user, guild);
    return bang.restrict.includes(tier);
}

export function formatAndAddLinkButton(content: string | CreateMessageOptions,
    title: string,
    link: string): CreateMessageOptions {
    if (typeof content === "string") content = { content: content };
    if (link) {
        content.components ??= [];
        content.components.push({
            type: ComponentTypes.ACTION_ROW,
            components: [{
                type: ComponentTypes.BUTTON,
                style: ButtonStyles.LINK,
                url: link,
                label: `Open in ${title}`
            }]
        });
    }
    return content;
}

export function registerBang(bangDef: Bang) {
    const { componentHandlers, ...bang } = bangDef;
    if (bang.predicate && !bang.predicate()) {
        if (!process.env.SUPPRESS_WARNINGS) console.warn(`Skipping bang ${bang.title} as predicate failed`);
        return;
    }
    bang.names.forEach(a => {
        if (bangs[a]) {
            console.error(`Duplicate bang ${a}`);
            return;
        } else {
            bangs[a] = bang;
        }
    });
    if (componentHandlers) allComponentHandlers.push(...componentHandlers);
}
