const CHUNK_SIZE = 256 * 1024;

export async function ocr(image: Buffer) {
    return new Promise<{ content: string; language: string } | void>(res => {
        const socket = new WebSocket("wss://olmocr.allenai.org/api/ws");
        socket.addEventListener("open", () => {
            const img = image.toString("base64");
            const chunks: string[] = [];
            for (let i = 0; i < img.length; i += CHUNK_SIZE) {
                chunks.push(img.slice(i, i + CHUNK_SIZE));
            }
            chunks.forEach(c => {
                socket.send(JSON.stringify({ fileChunk: c + "=" }));
            });

            socket.send(JSON.stringify({ endOfFile: true }));
        });
        socket.addEventListener("message", e => {
            const data = JSON.parse(e.data);
            if (data.type === "page_complete") {
                socket.close();
                res({
                    content: data.data.response.natural_text ?? "",
                    language: data.data.response.primary_language
                });
            } else if (data.type === "error") {
                if (!process.env.SUPPRESS_WARNINGS) console.log(data);
                socket.close();
                res();
            }
        });
        socket.addEventListener("error", e => {
            if (!process.env.SUPPRESS_WARNINGS) console.log(e);
            socket.close();
            res();
        });

        const timeout = setTimeout(() => {
            if (socket.readyState !== WebSocket.CLOSED) {
                socket.close();
                res();
            }
        }, 20000);
        socket.addEventListener("close", () => {
            clearTimeout(timeout);
        });
    });
}
