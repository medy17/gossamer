import type {
    Transport,
    TransportLogEntry,
    TransportStoryEntry,
} from "../core/types";

export class JsonStdoutTransport implements Transport {
    public log(entry: TransportLogEntry): void {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ type: "event", ...entry }));
    }

    public story(entry: TransportStoryEntry): void {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ type: "story", ...entry }));
    }
}
