import { deflateSync } from "zlib";
import { MessageFlags } from "oceanic.js";
import { EmbedBuilder } from "@oceanicjs/builders";
import { registerBang } from "../utils/bangs.ts";

interface Color {
    rgb: [number, number, number];
    hsl: [number, number, number];
}

const CSS_COLOR_NAMES = {
    aliceblue: "#f0f8ff", antiquewhite: "#faebd7", aqua: "#00ffff", aquamarine: "#7fffd4", azure: "#f0ffff",
    beige: "#f5f5dc", bisque: "#ffe4c4", black: "#000000", blanchedalmond: "#ffebcd", blue: "#0000ff",
    blueviolet: "#8a2be2", brown: "#a52a2a", burlywood: "#deb887", cadetblue: "#5f9ea0", chartreuse: "#7fff00",
    chocolate: "#d2691e", coral: "#ff7f50", cornflowerblue: "#6495ed", cornsilk: "#fff8dc", crimson: "#dc143c",
    cyan: "#00ffff", darkblue: "#00008b", darkcyan: "#008b8b", darkgoldenrod: "#b8860b", darkgray: "#a9a9a9",
    darkgreen: "#006400", darkkhaki: "#bdb76b", darkmagenta: "#8b008b", darkolivegreen: "#556b2f",
    darkorange: "#ff8c00", darkorchid: "#9932cc", darkred: "#8b0000", darksalmon: "#e9967a", darkseagreen: "#8fbc8f",
    darkslateblue: "#483d8b", darkslategray: "#2f4f4f", darkturquoise: "#00ced1", darkviolet: "#9400d3",
    deeppink: "#ff1493", deepskyblue: "#00bfff", dimgray: "#696969", dodgerblue: "#1e90ff", firebrick: "#b22222",
    floralwhite: "#fffaf0", forestgreen: "#228b22", fuchsia: "#ff00ff", gainsboro: "#dcdcdc", ghostwhite: "#f8f8ff",
    gold: "#ffd700", goldenrod: "#daa520", gray: "#808080", green: "#008000", greenyellow: "#adff2f",
    honeydew: "#f0fff0", hotpink: "#ff69b4", indianred: "#cd5c5c", indigo: "#4b0082", ivory: "#fffff0",
    khaki: "#f0e68c", lavender: "#e6e6fa", lavenderblush: "#fff0f5", lawngreen: "#7cfc00", lemonchiffon: "#fffacd",
    lightblue: "#add8e6", lightcoral: "#f08080", lightcyan: "#e0ffff", lightgoldenrodyellow: "#fafad2",
    lightgray: "#d3d3d3", lightgreen: "#90ee90", lightpink: "#ffb6c1", lightsalmon: "#ffa07a", lightseagreen: "#20b2aa",
    lightskyblue: "#87cefa", lightslategray: "#778899", lightsteelblue: "#b0c4de", lightyellow: "#ffffe0",
    lime: "#00ff00", limegreen: "#32cd32", linen: "#faf0e6", magenta: "#ff00ff", maroon: "#800000",
    mediumaquamarine: "#66cdaa", mediumblue: "#0000cd", mediumorchid: "#ba55d3", mediumpurple: "#9370db",
    mediumseagreen: "#3cb371", mediumslateblue: "#7b68ee", mediumspringgreen: "#00fa9a", mediumturquoise: "#48d1cc",
    mediumvioletred: "#c71585", midnightblue: "#191970", mintcream: "#f5fffa", mistyrose: "#ffe4e1",
    moccasin: "#ffe4b5", navajowhite: "#ffdead", navy: "#000080", oldlace: "#fdf5e6", olive: "#808000",
    olivedrab: "#6b8e23", orange: "#ffa500", orangered: "#ff4500", orchid: "#da70d6", palegoldenrod: "#eee8aa",
    palegreen: "#98fb98", paleturquoise: "#afeeee", palevioletred: "#db7093", papayawhip: "#ffefd5",
    peachpuff: "#ffdab9", peru: "#cd853f", pink: "#ffc0cb", plum: "#dda0dd", powderblue: "#b0e0e6",
    purple: "#800080", rebeccapurple: "#663399", red: "#ff0000", rosybrown: "#bc8f8f", royalblue: "#4169e1",
    saddlebrown: "#8b4513", salmon: "#fa8072", sandybrown: "#f4a460", seagreen: "#2e8b57", seashell: "#fff5ee",
    sienna: "#a0522d", silver: "#c0c0c0", skyblue: "#87ceeb", slateblue: "#6a5acd", slategray: "#708090",
    snow: "#fffafa", springgreen: "#00ff7f", steelblue: "#4682b4", tan: "#d2b48c", teal: "#008080",
    thistle: "#d8bfd8", tomato: "#ff6347", turquoise: "#40e0d0", violet: "#ee82ee", wheat: "#f5deb3",
    white: "#ffffff", whitesmoke: "#f5f5f5", yellow: "#ffff00", yellowgreen: "#9acd32",
    grey: "#808080",
    darkgrey: "#a9a9a9",
    dimgrey: "#696969",
    lightgrey: "#d3d3d3",
    slategrey: "#708090",
    darkslategrey: "#2f4f4f",
    lightslategrey: "#778899"
} as Record<string, string>;


function rgbToHsl(r: number, g: number, b: number): Color["hsl"] {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b);

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): Color["rgb"] {
    let r, g, b;
    h /= 360;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r * 255, g * 255, b * 255];
}


function parseHex(str: string): [number, number, number] | undefined {
    let match = str.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);

    if (!match && !str.includes(" ")) {
        if (/^[0-9a-f]{1,6}$/i.test(str)) {
            match = [str, str]; // Create a match-like array
        }
    }

    if (!match) {
        return undefined;
    }

    let hex = match[1]!;

    if (hex.length === 3) {
        hex = hex.split("").map(char => char + char).join("");
    }
    if (hex.length !== 6) return undefined;

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return [r, g, b];
}

function parseHsl(str: string, numbers: Color["hsl"]): Color["rgb"] | undefined {
    const hasHsl = str.includes("hsl");
    const hasPercent = str.includes("%");
    const isDecimal = numbers[1] <= 1 && numbers[2] <= 1;

    if (!hasHsl && !hasPercent && !isDecimal) {
        return undefined;
    }

    let [h, s, l] = numbers;

    // Normalize s and l: if they are > 1, assume they are percentages
    if (s > 1) s /= 100;
    if (l > 1) l /= 100;

    // Clamp values to their valid ranges
    h %= 360;
    if (h < 0) h += 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));

    return hslToRgb(h, s, l);
}

function parseRgb(numbers: Color["rgb"]): Color["rgb"] | undefined {
    let [r, g, b] = numbers;

    // Clamp values
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    return [r, g, b];
}

function parseColor(inputString: string): Color | undefined {
    const str = inputString.trim().toLowerCase();
    let rgb: [number, number, number] | undefined =
        CSS_COLOR_NAMES[str] ? parseHex(CSS_COLOR_NAMES[str]) : parseHex(str);

    if (!rgb) {
        const numbers = str.match(/-?[\d.]+/g)?.map(Number) as [number, number, number];

        if (numbers && numbers.length >= 3) {
            rgb = parseHsl(str, numbers) || parseRgb(numbers);
        } else return undefined;
    }

    if (rgb) {
        const [r, g, b] = rgb.map(val => Math.round(val));
        const [h, s, l] = rgbToHsl(r!, g!, b!);

        return {
            rgb: [r!, g!, b!],
            hsl: [Math.round(h), s, l],
        };
    }

    return undefined;
}

// -------------------------------------------------
// UTILITY - CRC32 Checksum
// -------------------------------------------------
// This is a standard CRC32 implementation.
const crcTable = new Int32Array(256).map((_, i) => {
    let c = i;
    for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c;
});

function crc32(buffer: Buffer) {
    let crc = -1;
    for (const byte of buffer) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ byte!) & 0xff]!;
    }
    return (crc ^ -1) >>> 0;
}

// -------------------------------------------------
// PNG CHUNK HELPERS
// -------------------------------------------------
function createChunk(type: string, data: Buffer) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const typeBuffer = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

    return Buffer.concat([length, typeBuffer, data, crc]);
}

function generateSolidColorPng(width: number, height: number, color: Color["rgb"]) {
    // -------------------------------------------------
    // PNG FILE STRUCTURE
    // -------------------------------------------------

    // 1. PNG Signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // 2. IHDR Chunk (Image Header)
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0); // Width
    ihdrData.writeUInt32BE(height, 4); // Height
    ihdrData.writeUInt8(8, 8); // Bit depth (8 bits per channel)
    ihdrData.writeUInt8(2, 9); // Color type (2 = RGB Truecolor)
    ihdrData.writeUInt8(0, 10); // Compression method (0 = DEFLATE)
    ihdrData.writeUInt8(0, 11); // Filter method (0 = Adaptive)
    ihdrData.writeUInt8(0, 12); // Interlace method (0 = No interlace)
    const ihdrChunk = createChunk("IHDR", ihdrData);

    // 3. IDAT Chunk (Image Data)
    const bytesPerPixel = 3; // R, G, B
    const scanlineLength = 1 + width * bytesPerPixel; // 1 byte for filter type
    const pixelData = Buffer.alloc(height * scanlineLength);

    for (let y = 0; y < height; y++) {
        const offset = y * scanlineLength;
        pixelData.writeUInt8(0, offset); // Filter type 0 (None)
        for (let x = 0; x < width; x++) {
            const pixelOffset = offset + 1 + x * bytesPerPixel;
            pixelData.writeUInt8(color[0], pixelOffset);
            pixelData.writeUInt8(color[1], pixelOffset + 1);
            pixelData.writeUInt8(color[2], pixelOffset + 2);
        }
    }

    // Compress the pixel data
    const compressedPixelData = deflateSync(pixelData);
    const idatChunk = createChunk("IDAT", compressedPixelData);

    // 4. IEND Chunk (End of Image)
    const iendChunk = createChunk("IEND", Buffer.alloc(0));

    // Concatenate all parts to form the final PNG buffer
    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

registerBang({
    title: "Color viewer",
    names: ["color", "clr", "hex", "rgb"],
    ignoreIfBlank: true,
    shortExecute: true,
    execute: async content => {
        const color = parseColor(content);
        if (!color) return {
            content: {
                content: "That's not a color I know",
                flags: MessageFlags.EPHEMERAL
            }
        };

        const hex = color.rgb[0].toString(16).padStart(2, "0")
            + color.rgb[1].toString(16).padStart(2, "0")
            + color.rgb[2].toString(16).padStart(2, "0");
        const s = Math.floor(color.hsl[1] * 10 ** 4) / 100;
        const l = Math.floor(color.hsl[2] * 10 ** 4) / 100;

        return {
            content: {
                embeds: [new EmbedBuilder()
                    .setAuthor(`#${hex} - rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]}) - \
hsl(${color.hsl[0]}, ${s}%, ${l}%)`)
                    .setColor(parseInt(hex, 16))
                    .setImage("attachment://image.png")
                    .toJSON()
                ],
                files: [{
                    name: "image.png",
                    contents: generateSolidColorPng(256, 256, color.rgb)
                }]
            }
        };
    }
});
