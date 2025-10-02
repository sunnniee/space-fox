import { parse } from "node-html-parser";

export type Result = {
    siteTitle: string;
    siteIcon: string;
    title: string;
    url: string;
    description: string;
};

export async function search(query: string) {
    const req = await fetch(
        "https://search.br" + `ave.com/search?q=${encodeURIComponent(query)}`,
        {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
                "Cookie": "country=all; useLocation=0; summarizer=0;"
            }
        }
    );

    let results: Result[];
    try {
        if (req.status !== 200) throw new Error(`search: Got status code ${req.status}`);
        const res = await req.text();
        const html = parse(res);
        results = html.querySelectorAll(".snippet:has(> .heading-serpresult)").map(el => ({
            siteTitle: el.querySelector(".sitename").textContent,
            siteIcon: el.querySelector(".favicon").attrs.src,
            title: el.querySelector(".title").textContent,
            url: el.querySelector(".heading-serpresult").attrs.href,
            description: (el.querySelector(".snippet-description") || el.querySelector(".inline-qa-answer > p"))?.textContent || "[no description]"
        })) satisfies Result[];
        if (!results[0]) throw undefined;
    } catch(e) {
        if (e) console.log(e);
    }

    return results;
}
