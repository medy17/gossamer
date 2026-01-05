import fs from "node:fs";
import path from "node:path";
import type {
    Transport,
    TransportLogEntry,
    TransportStoryEntry,
} from "../core/types";

export type FileTransportOptions = {
    /**
     * Path to the log file.
     */
    path: string;
    /**
     * Whether to append to existing file or overwrite. Default: true (append).
     */
    append?: boolean;
};

/**
 * File transport that writes JSON lines to a file.
 * Each log entry is written as a single line of JSON.
 */
export class FileTransport implements Transport {
    private filePath: string;
    private stream: fs.WriteStream | null = null;

    public constructor(options: FileTransportOptions) {
        this.filePath = path.resolve(options.path);

        // Ensure directory exists
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Open file for appending (or writing)
        const flags = options.append !== false ? "a" : "w";
        this.stream = fs.createWriteStream(this.filePath, { flags });
    }

    public log(entry: TransportLogEntry): void {
        if (!this.stream) return;

        const line = JSON.stringify({ type: "event", ...entry }) + "\n";
        this.stream.write(line);
    }

    public story(entry: TransportStoryEntry): void {
        if (!this.stream) return;

        const line = JSON.stringify({ type: "story", ...entry }) + "\n";
        this.stream.write(line);
    }

    /**
     * Flush buffered logs to disk.
     */
    public flush(): Promise<void> {
        if (!this.stream) return Promise.resolve();

        return new Promise((resolve) => {
            if (this.stream?.write("")) {
                resolve();
            } else {
                this.stream?.once("drain", resolve);
            }
        });
    }

    /**
     * Close the file stream. Call this during graceful shutdown.
     */
    public close(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.stream) {
                resolve();
                return;
            }

            this.stream.end((err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });

            this.stream = null;
        });
    }
}
