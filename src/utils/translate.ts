type Response = { sourceLanguage: string; translation: string };

export async function googleTranslate(text: string, targetLang: string) {
    // stolen from vencord
    const url = "https://translate-pa.googleapis.com/v1/translate?" + new URLSearchParams({
        "params.client": "gtx",
        "dataTypes": "TRANSLATION",
        "key": "AIzaSyDLEeFI5OtFBwYBIoK_jj5m32rZK5CkCXA",
        "query.sourceLanguage": "auto",
        "query.targetLanguage": targetLang,
        "query.text": text,
    });

    const res = await fetch(url);
    if (!res.ok)
        throw new Error(
            `Failed to translate "${text}" (${targetLang})`
            + `\n${res.status} ${res.statusText}`
        );

    const { sourceLanguage, translation } = await res.json() as Response;

    return {
        sourceLanguage,
        text: translation
    };
}
