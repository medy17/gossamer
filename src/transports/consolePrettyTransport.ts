import type {
    ColourName,
    Transport,
    TransportLogEntry,
    TransportStoryEntry,
} from "../core/types";

type Options = {
    pretty?: boolean;
};

const ANSI: Record<string, string> = {
    reset: "\u001b[0m",
    grey: "\u001b[90m",
    red: "\u001b[31m",
    green: "\u001b[32m",
    yellow: "\u001b[33m",
    blue: "\u001b[34m",
    magenta: "\u001b[35m",
    cyan: "\u001b[36m",
    white: "\u001b[37m",
};

function colourise(colour: ColourName | undefined, text: string): string {
    const c = colour ?? "white";
    const code = ANSI[c] ?? ANSI.white;
    return `${code}${text}${ANSI.reset}`;
}

export class ConsolePrettyTransport implements Transport {
    private pretty: boolean;

    public constructor(options: Options = {}) {
        this.pretty = options.pretty ?? true;
    }

    public log(entry: TransportLogEntry): void {
        if (!this.pretty) {
            // JSON-ish, still readable
            // eslint-disable-next-line no-console
            console.log(JSON.stringify(entry));
            return;
        }

        const level = entry.level.toUpperCase();
        const levelColour =
            level === "ERROR"
                ? "red"
                : level === "WARN"
                    ? "yellow"
                    : level === "INFO"
                        ? "cyan"
                        : "white";

        const ts = colourise("grey", entry.timestamp);
        const lvl = colourise(levelColour, level.padEnd(5));
        const ev = colourise("magenta", entry.event);

        // Build ID suffix if any IDs present
        const ids: string[] = [];
        if (entry.request_id) ids.push(`req:${entry.request_id}`);
        if (entry.trace_id) ids.push(`trace:${entry.trace_id}`);
        if (entry.span_id) ids.push(`span:${entry.span_id}`);
        const idSuffix = ids.length ? colourise("grey", ` [${ids.join(" ")}]`) : "";

        // eslint-disable-next-line no-console
        console.log(`${ts} ${lvl} ${ev} ${entry.message}${idSuffix}`);

        if (entry.payload && Object.keys(entry.payload).length) {
            // eslint-disable-next-line no-console
            console.log(colourise("grey", JSON.stringify(entry.payload, null, 2)));
        }
    }

    public story(entry: TransportStoryEntry): void {
        const header = `GOSSAMER STORY: ${entry.storyName} (${entry.storyId})`;
        const status =
            entry.status === "complete"
                ? colourise("green", entry.status)
                : colourise("yellow", entry.status);

        const line = [
            colourise("grey", entry.timestamp),
            colourise("blue", header),
            status,
            colourise("grey", `${entry.durationMs}ms`),
        ].join(" ");

        // eslint-disable-next-line no-console
        console.log(line);

        // eslint-disable-next-line no-console
        console.log(colourise("grey", JSON.stringify(entry, null, 2)));
    }
}
