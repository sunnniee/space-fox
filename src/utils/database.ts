import { readFileSync } from "fs";
import { readFile, writeFile as _writeFile } from "fs/promises";
import path from "path";

const writeFile = new Proxy(_writeFile, {
    apply(target, thisArg, argArray) {
        return target.apply(thisArg, argArray).catch(e => {
            console.error(`Failed to write to ${argArray[0]}: ${e}`);
            return Promise.reject();
        });
    },
});

export class JSONDatabase<Schema> {
    private filePath: string;
    private cache = {} as Record<string, Schema>;
    private writing = false;
    private writeQueued = false;

    constructor(filePath: string) {
        this.filePath = path.resolve(process.cwd(), filePath);
        readFile(this.filePath, "utf8").then(i => {
            try {
                this.cache = JSON.parse(i) || {};
            } catch {
                if (!process.env.SUPPRESS_WARNINGS) console.warn(`Failed to parse file ${this.filePath}`);
                this.cache = {};
            }
        }).catch(() => {
            if (!process.env.SUPPRESS_WARNINGS) console.warn(`Failed to read file ${this.filePath}`);
        });
    }

    private write = async () => {
        if (this.writing) return this.writeQueued = true;
        this.writing = true;
        writeFile(this.filePath, JSON.stringify(this.cache)).then(() => {
            this.writing = false;
            if (this.writeQueued) {
                this.writeQueued = false;
                this.write();
            }
        });
    };

    private refresh() {
        this.cache = JSON.parse(readFileSync(this.filePath, "utf8"));
    }

    get(id: string): Readonly<Schema | void> {
        return this.cache[id];
    }

    getAll(): Readonly<typeof this.cache> {
        return this.cache;
    }

    set(id: string, value: Schema) {
        this.cache[id] = value;
        this.write();
        return true;
    }

    delete(id: string) {
        const current = this.get(id);
        if (current) {
            delete this.cache[id];
            this.write();
        }
        return current;
    }
}
