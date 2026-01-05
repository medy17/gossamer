import type {
    Transport,
    TransportLogEntry,
    TransportStoryEntry,
} from "../core/types";

export type HttpTransportOptions = {
    /**
     * URL to POST log events to.
     */
    url: string;
    /**
     * Number of events to batch before sending. Default: 100.
     */
    batchSize?: number;
    /**
     * Maximum time (ms) to wait before flushing the batch. Default: 5000.
     */
    flushIntervalMs?: number;
    /**
     * Optional headers to include in requests.
     */
    headers?: Record<string, string>;
    /**
     * Optional timeout for requests in ms. Default: 10000.
     */
    timeoutMs?: number;
};

type BatchItem = {
    type: "event" | "story";
    data: TransportLogEntry | TransportStoryEntry;
};

/**
 * HTTP transport that batches events and sends them to a webhook endpoint.
 * Events are sent as a JSON array.
 */
export class HttpTransport implements Transport {
    private url: string;
    private batchSize: number;
    private flushIntervalMs: number;
    private headers: Record<string, string>;
    private timeoutMs: number;

    private batch: BatchItem[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private isFlushing = false;

    public constructor(options: HttpTransportOptions) {
        this.url = options.url;
        this.batchSize = options.batchSize ?? 100;
        this.flushIntervalMs = options.flushIntervalMs ?? 5000;
        this.headers = {
            "Content-Type": "application/json",
            ...options.headers,
        };
        this.timeoutMs = options.timeoutMs ?? 10000;

        // Start the flush interval timer
        this.startFlushTimer();
    }

    public log(entry: TransportLogEntry): void {
        this.batch.push({ type: "event", data: entry });
        this.maybeFlush();
    }

    public story(entry: TransportStoryEntry): void {
        this.batch.push({ type: "story", data: entry });
        this.maybeFlush();
    }

    private startFlushTimer(): void {
        if (this.flushTimer) return;

        this.flushTimer = setInterval(() => {
            this.flush().catch(() => {
                // Swallow errors in background flush
            });
        }, this.flushIntervalMs);
    }

    private maybeFlush(): void {
        if (this.batch.length >= this.batchSize) {
            this.flush().catch(() => {
                // Swallow errors
            });
        }
    }

    /**
     * Flush the current batch to the server.
     */
    public async flush(): Promise<void> {
        if (this.batch.length === 0 || this.isFlushing) return;

        this.isFlushing = true;
        const toSend = [...this.batch];
        this.batch = [];

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

            await fetch(this.url, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify(toSend),
                signal: controller.signal,
            });

            clearTimeout(timeout);
        } catch {
            // Put failed items back at the front of the batch for retry
            this.batch = [...toSend, ...this.batch];

            // Trim batch if it gets too large to prevent memory issues
            if (this.batch.length > this.batchSize * 10) {
                this.batch = this.batch.slice(-this.batchSize * 5);
            }
        } finally {
            this.isFlushing = false;
        }
    }

    /**
     * Stop the transport and flush remaining events.
     */
    public async close(): Promise<void> {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }

        await this.flush();
    }
}
