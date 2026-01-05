type ColourName = "grey" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white";
type LevelName = string;
type EventName = string;
type StoryTrackMode = "append" | "count" | "ignore";
type StoryTrackRule = {
    mode?: StoryTrackMode;
    counter?: string;
    pick?: string[];
    redact?: string[];
};
type StoryDefinition = {
    enabled?: boolean;
    correlationKey: string;
    trigger: EventName;
    ender?: EventName;
    track?: Record<EventName, StoryTrackRule>;
    maxAgeMs?: number;
    orphanStrategy?: "ignore" | "start";
};
type LevelDefinition = {
    label?: string;
    colour?: ColourName;
    icon?: string;
    active?: boolean;
    minVerbosity?: number;
};
type EventDefinition = {
    level: LevelName;
    active?: boolean;
    verbosity?: number;
    message?: string;
    redact?: string[];
};
type GossamerUserConfig = {
    enabled?: boolean;
    verbosity?: number;
    levels?: Record<LevelName, LevelDefinition>;
    events?: Record<EventName, EventDefinition>;
    stories?: Record<string, StoryDefinition>;
    unknownEvents?: {
        enabled?: boolean;
        level?: LevelName;
    };
};
type TransportLogEntry = {
    timestamp: string;
    event_id: string;
    level: string;
    event: string;
    message: string;
    request_id?: string;
    trace_id?: string;
    span_id?: string;
    payload?: Record<string, unknown>;
};
type TransportStoryEntry = {
    timestamp: string;
    storyName: string;
    storyId: string;
    status: "complete" | "stale" | "ended";
    meta: Record<string, unknown>;
    durationMs: number;
    counters: Record<string, number>;
    timeline: Array<{
        timestamp: string;
        event: string;
        payload?: Record<string, unknown>;
    }>;
    /** Number of events in the timeline */
    event_count: number;
    /** First event name in the timeline */
    first_event?: string;
    /** Last event name in the timeline */
    last_event?: string;
    /** Whether any event in the timeline had an error level */
    has_error: boolean;
};
type Transport = {
    log(entry: TransportLogEntry): void;
    story(entry: TransportStoryEntry): void;
};
type EmitOptions = {
    message?: string;
    verbosityOverride?: number;
};
/**
 * Timer object returned by gossamer.startTimer().
 * Call end() to emit the event with calculated duration_ms.
 */
type Timer = {
    /**
     * End the timer and emit the event with duration_ms calculated.
     */
    end: (additionalPayload?: Record<string, unknown>, options?: EmitOptions) => void;
    /**
     * Cancel the timer without emitting an event.
     */
    cancel: () => void;
};
/**
 * Sampling strategy function. Receives a log entry and returns:
 * - true: keep the event (send to transports)
 * - false: drop the event (don't send to transports)
 *
 * Common patterns:
 * - Always keep errors: `entry.level === "ERROR"`
 * - Always keep slow requests: `entry.payload?.duration_ms > 2000`
 * - Random sample: `Math.random() < 0.05` (5% sample)
 */
type SamplingStrategy = (entry: TransportLogEntry) => boolean;
type GossamerInitOptions = {
    transports?: Transport[];
    /**
     * Sampling strategy for log events. If provided, each event is passed
     * to this function before being sent to transports. Return true to keep,
     * false to drop. If not provided, all events are kept.
     *
     * Note: Stories are NOT affected by sampling - they always emit.
     */
    samplingStrategy?: SamplingStrategy;
};
type GossamerResolvedConfig = {
    enabled: boolean;
    verbosity: number;
    levels: Record<LevelName, Required<LevelDefinition>>;
    events: Record<EventName, Required<EventDefinition>>;
    stories: Record<string, Required<StoryDefinition> & {
        _trackEvents: Set<EventName>;
        _allRelevantEvents: Set<EventName>;
    }>;
    storyIndex: {
        eventToStoryNames: Map<EventName, Set<string>>;
        storyRelatedEvents: Set<EventName>;
    };
    unknownEvents: {
        enabled: boolean;
        level: LevelName;
    };
    formatLogEntry(input: {
        eventName: string;
        payload: Record<string, unknown>;
        level: LevelName;
        message?: string;
        redact?: string[];
    }): TransportLogEntry;
};

declare class Gossamer {
    private initialised;
    private config;
    private transports;
    private storyEngine;
    private queue;
    private context;
    private samplingStrategy;
    init(userConfig: GossamerUserConfig, options?: GossamerInitOptions): Promise<void>;
    initFromFile(options?: {
        path?: string;
    }, initOptions?: GossamerInitOptions): Promise<void>;
    emit(eventName: string, payload?: Record<string, unknown>, options?: EmitOptions): void;
    getConfig(): GossamerResolvedConfig | null;
    isInitialised(): boolean;
    /**
     * Set ambient context that will be merged into all emitted events.
     * Merges with existing context (does not replace).
     */
    setContext(ctx: Record<string, unknown>): void;
    /**
     * Clear all ambient context.
     */
    clearContext(): void;
    /**
     * Get a copy of the current ambient context.
     */
    getContext(): Record<string, unknown>;
    /**
     * Execute a function with temporary additional context.
     * The temporary context is merged on top of existing context for the duration.
     * After the function completes (or throws), context is restored.
     */
    withContext<T>(tempContext: Record<string, unknown>, fn: () => T): T;
    /**
     * Async version of withContext for async functions.
     */
    withContextAsync<T>(tempContext: Record<string, unknown>, fn: () => Promise<T>): Promise<T>;
    /**
     * Set a sampling strategy at runtime.
     * Pass null to disable sampling (keep all events).
     */
    setSamplingStrategy(strategy: SamplingStrategy | null): void;
    /**
     * Start a timer for measuring event duration.
     * Call timer.end() to emit the event with duration_ms automatically calculated.
     *
     * @example
     * const timer = gossamer.startTimer("db:query");
     * await runQuery();
     * timer.end({ rows: 42 }); // Emits with duration_ms
     */
    startTimer(eventName: string, initialPayload?: Record<string, unknown>): Timer;
    /**
     * Emit an error event with standardized error payload.
     * Automatically extracts name, message, code, and stack from the error.
     *
     * @example
     * try { ... } catch (err) {
     *   gossamer.emitError("order:failed", err, { order_id: "123" });
     * }
     */
    emitError(eventName: string, error: unknown, additionalPayload?: Record<string, unknown>, options?: EmitOptions): void;
    /**
     * Normalize an error into a standardized payload object.
     */
    private normalizeError;
}
declare const gossamer: Gossamer;

type Options = {
    pretty?: boolean;
};
declare class ConsolePrettyTransport implements Transport {
    private pretty;
    constructor(options?: Options);
    log(entry: TransportLogEntry): void;
    story(entry: TransportStoryEntry): void;
}

type FileTransportOptions = {
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
declare class FileTransport implements Transport {
    private filePath;
    private stream;
    constructor(options: FileTransportOptions);
    log(entry: TransportLogEntry): void;
    story(entry: TransportStoryEntry): void;
    /**
     * Close the file stream. Call this during graceful shutdown.
     */
    close(): Promise<void>;
}

type HttpTransportOptions = {
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
/**
 * HTTP transport that batches events and sends them to a webhook endpoint.
 * Events are sent as a JSON array.
 */
declare class HttpTransport implements Transport {
    private url;
    private batchSize;
    private flushIntervalMs;
    private headers;
    private timeoutMs;
    private batch;
    private flushTimer;
    private isFlushing;
    constructor(options: HttpTransportOptions);
    log(entry: TransportLogEntry): void;
    story(entry: TransportStoryEntry): void;
    private startFlushTimer;
    private maybeFlush;
    /**
     * Flush the current batch to the server.
     */
    flush(): Promise<void>;
    /**
     * Stop the transport and flush remaining events.
     */
    close(): Promise<void>;
}

declare class JsonStdoutTransport implements Transport {
    log(entry: TransportLogEntry): void;
    story(entry: TransportStoryEntry): void;
}

type ValidationError = {
    path: string;
    message: string;
    suggestion?: string;
};
type ValidationResult = {
    valid: boolean;
    errors: ValidationError[];
};
/**
 * Validate a Gossamer user config and return helpful error messages.
 */
declare function validateConfig(config: GossamerUserConfig): ValidationResult;
/**
 * Validate config and throw if invalid.
 */
declare function assertValidConfig(config: GossamerUserConfig): void;

export { ConsolePrettyTransport, type EmitOptions, type EventDefinition, FileTransport, type GossamerInitOptions, type GossamerResolvedConfig, type GossamerUserConfig, HttpTransport, JsonStdoutTransport, type LevelDefinition, type SamplingStrategy, type StoryDefinition, type StoryTrackRule, type Timer, type Transport, type TransportLogEntry, type TransportStoryEntry, type ValidationError, type ValidationResult, assertValidConfig, gossamer, validateConfig };
