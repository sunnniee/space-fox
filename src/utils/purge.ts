import { bangInputs, promptHistory } from "../globals.ts";

const purgeHandlers: (() => any)[] = [];
export function purgeOldValues<T extends { at: number }>(obj: Record<any, T>, after: number, sideEffect?: (obj: T) => any) {
    purgeHandlers.push(() => {
        for (const [k, { at }] of Object.entries(obj)) {
            if (Date.now() - at > after) {
                if (sideEffect) sideEffect(obj[k]);
                delete obj[k];
            }
        }
    });
}
purgeOldValues(bangInputs, 120_000);
purgeOldValues(promptHistory, 600_000);

setInterval(() => {
    purgeHandlers.forEach(h => h());
}, 5000);
