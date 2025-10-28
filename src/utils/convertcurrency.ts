import { purgeOldValues } from "./purge.ts";

type Response = {
    date: string;
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
} & {
    [currencyName: string]: Record<string, number>;
};
const currencyCache = {} as Record<string, {
    values: Response;
    at: number;
}>;
purgeOldValues(currencyCache, 86_400_000);

function validate(json: unknown): json is Response {
    return typeof json === "object" && "date" in json;
}

export async function convertCurrency(amountFrom: number, currencyFrom: string, currencyTo: string) {
    if (!currencyCache[currencyFrom.toLowerCase()]) {
        let json: Response;
        try {
            const res = await (await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies\
/${currencyFrom.toLowerCase()}.min.json`)).json();
            if (!validate(res)) throw "";
            json = res;
        } catch {
            return { response: "Failed to convert - failed to get 'from' currency" };
        }
        currencyCache[currencyFrom.toLowerCase()] = {
            values: json,
            at: Date.now()
        };
    }

    const table = currencyCache[currencyFrom.toLowerCase()]!.values[currencyFrom.toLowerCase()];
    if (!(currencyTo.toLowerCase() in table))
        return { response: "Failed to convert - failed to get 'to' currency" };

    return { response: amountFrom * table[currencyTo.toLowerCase()] };
}
