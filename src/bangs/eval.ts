/* eslint-disable @typescript-eslint/no-unused-vars */
import { inspect } from "util";

import { client } from "../client.ts";
import * as globals from "../globals.ts";
import * as reminder from "../utils/reminders.ts";
import type { Bang } from "../types.ts";
import { PermissionTier } from "../permissions.ts";
import { registerBang } from "../utils/bangs.ts";

const MAX_RESPONSE_LENGTH = 1980;

registerBang({
    title: "Run code",
    names: ["eval", "e", "ev"],
    restrict: [PermissionTier.ME],
    ignoreIfBlank: true,
    shortExecute: true,
    execute: async (code, attachments, ctx) => {
        const reportError = (e: Error): string => {
            const evalPos = e.stack!.split("\n").findIndex(l => l.includes("at eval"));
            const stack = e.stack!.split("\n").splice(0, evalPos).join("\n");

            return stack;
        };
        try {
            return await (eval(`(async function(){${code}})().catch(reportError)`) as Promise<any>).then(evalResult => {
                let result = inspect(evalResult, { depth: 5 });

                if (result.length > MAX_RESPONSE_LENGTH)
                    for (let i = 4; i > 0; i--) {
                        if (result.length > MAX_RESPONSE_LENGTH) result = inspect(evalResult, { depth: i });
                        else break;
                    }

                if (result.length > MAX_RESPONSE_LENGTH) {
                    return {
                        content: {
                            files: [{
                                name: "output.js",
                                contents: Buffer.from(inspect(evalResult, { depth: 4 }))
                            }]
                        }
                    };
                }

                return { content: "```js\n" + result + "```" };
            }).catch(e => { return { content: reportError(e) }; });
        } catch (e) {
            if (e instanceof Error)
                return { content: reportError(e) };
            return { content: "this should definitely not be here" };
        }
    }
});
