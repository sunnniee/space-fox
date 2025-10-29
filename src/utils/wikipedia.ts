export async function wikipedia(query: string, language = "en", introOnly = false, plaintext = false) {
    const searchResult = await (
        await fetch(`https://${language}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}\
&limit=1&redirects=resolve`)
    ).json();
    if (!Array.isArray(searchResult) || !searchResult[3][0]) return { error: "Couldn't find an entry relating to that" };

    const title = searchResult[1][0];
    const params = new URLSearchParams({
        action: "query",
        prop: "extracts|pageimages|pageprops|links",
        format: "json",
        pithumbsize: "2048",
        pilimit: "1",
        pllimit: "max",
        titles: title,
    });
    if (introOnly) params.append("exintro", "");
    if (plaintext) params.append("explaintext", "");

    const article = await (
        await fetch(`https://${language}.wikipedia.org/w/api.php?${params.toString()}`)
    ).json() as any;
    const page = Object.values(article.query.pages as Record<string, any>)[0];

    const isDisambiguation = "disambiguation" in page.pageprops;
    if (isDisambiguation) {
        const results: string[] = page.links.filter((p: any) => p.ns === 0).map((p: any) => p.title);
        return {
            title,
            text: page.extract,
            link: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
            thumbnail: null,
            isDisambiguation: true,
            results
        };
    }

    return {
        title,
        text: page.extract,
        thumbnail: page.thumbnail?.source,
        link: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        isDisambiguation: false
    };
}
