import { parse } from "node-html-parser";

export interface Result {
    siteTitle: string;
    siteIcon: string;
    title: string;
    url: string;
    description: string;
}

export interface SearchReponse {
    results: Result[];
    comment?: string;
}

export async function search(query: string): Promise<SearchReponse> {
    const req = await fetch(
        "https://search.br" + `ave.com/search?q=${encodeURIComponent(query)}`,
        {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
                "Cookie": "country=all; useLocation=0; summarizer=0;"
            }
        }
    );

    let results: Result[] = [];
    let comment: string | undefined = undefined;
    try {
        if (req.status !== 200) {
            comment = req.status.toString();
            throw new Error(`search: Got status code ${req.status}`);
        }
        const res = await req.text();
        const html = parse(res);
        results = html.querySelectorAll(".snippet:has(> .result-wrapper)").map(el => ({
            siteTitle: el.querySelector(".site-name-content > .t-secondary")!.textContent,
            siteIcon: el.querySelector(".favicon")!.attrs.src!,
            title: el.querySelector(".title")!.textContent,
            url: el.querySelector(".l1")!.attrs.href!,
            description: el.querySelector(".generic-snippet > .content")?.textContent
                || el.querySelectorAll(".inline-qa-answer")?.map(a => a.textContent).join("\n\n")
                || "[no description]"
        })) satisfies Result[];

        const discussions = html.querySelectorAll(".discussions-item").map(el => ({
            title: el.querySelector(".title")!.textContent,
            siteTitle: el.querySelector(".item:has(> .favicon)")!.textContent,
            siteIcon: el.querySelector(".favicon")!.attrs.src!,
            description: el.querySelector(".content")!.textContent,
            url: el.querySelector(".source")!.attrs.href!
        })) satisfies Result[];

        // rougly their spot in normal searches
        results.splice(2, 0, ...discussions);

        const comments = html.querySelector("#advanced-keywords");
        if (comments) {
            const text = [...comments.querySelectorAll(".title, .subtitle")!].map(e => e.textContent);
            comment = text.join(". ").replace(/ +/g, " ").trim();
        }

        if (!("0" in results)) throw undefined;
        else if (results.length === 0) comment = "No results found.\n" + comment || "";
    } catch(e) {
        if (e) console.log(e);
    }

    return { results, comment };
}
