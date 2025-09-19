// the code for this is horrid
// you have been warned
// TODO: switch to some proper html parsing

function standardize(unit: string, valueStr: string) {
    unit = unit.toLowerCase();
    if (
        ["celsius", "fahrenheit", "psi", "feet"].includes(unit)
        || unit.includes(" per ")
    )
        return unit;

    const value = parseFloat(valueStr);
    if (value !== 1 && !unit.endsWith("s")) unit += "s";
    else if (value === 1 && unit.endsWith("s"))
        unit = unit.substring(0, unit.length - 1);

    if (unit.endsWith(")s")) {
        const words = unit.split(" ");
        unit = [
            ...words.splice(0, words.length - 2),
            words[0] + "s",
            words[1].substring(0, words[1].length - 1),
        ].join(" ");
    }
    return unit;
}

function checkCurrency(body: string, short = false): string | false {
    const currMatch = body.match(
        />([\d,.]+)<\/span>\s(.+?) equals<\/.{0,200}>([\d,.]+)<\/span>\s(.+?)<\/div><\/div>/
    );

    if (currMatch) {
        const [_, valueFrom, currFrom, valueTo, currTo] = currMatch;
        if (short) return valueTo;
        else return `${valueFrom} ${currFrom} is equal to **${valueTo}** ${currTo}`;
    } else return false;
}

function checkUnit(body: string, short = false): string | false {
    const unitMatch = body.match(
        /value="([\d,.]+)"\/>\s?<select name="unitFrom".{0,100}option value="[\w/]+" selected>([\w ()]+)<\/option.+value="([\d,.]+)"\/>\s?<select name="unitTo".{0,100}option value="[\w/]+" selected>([\w ()]+)<\/option/
    );

    if (unitMatch) {
        const [_, valueFrom, unitFrom, valueTo, unitTo] = unitMatch;
        if (short) return valueTo;
        else return `${valueFrom} ${standardize(
            unitFrom,
            valueFrom
        )} is equal to **${valueTo}** ${standardize(unitTo, valueTo)}`;
    } else return false;
}

function checkCrypto(body: string, short = false) {
    const cryptoMatch = body.match(
        /value="([\d.]+)"\/>\s<div class="coin-label.{0,50}visible-label.{0,20}(\w{3}).+?value="([\d.]+)"\/>\s<div class="coin-label.{0,50}visible-label.{0,20}(\w{3})/m
    );

    if (cryptoMatch) {
        const [_, valueFrom, currFrom, valueTo, currTo] = cryptoMatch;
        if (short) return valueTo;
        else return `${valueFrom} ${currFrom.toUpperCase()} is equal to **${valueTo}** ${currTo.toUpperCase()}`;
    } else return false;
}

export async function convert(input: string, short = false): Promise<string> {
    const page = await fetch(
        "https://search.br" + `ave.com/search?q=convert+${encodeURIComponent(input)}`,
        {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
                "Cookie": "country=all; useLocation=0; summarizer=0;"
            }
        }
    );
    if (page.status !== 200) return "Failed to convert";
    const body = await page.text();

    return checkCurrency(body, short)
        || checkUnit(body, short)
        || checkCrypto(body, short)
        || "Failed to convert";
}
