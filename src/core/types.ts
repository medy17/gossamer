export type ColourName =
    | "grey"
    | "red"
    | "green"
    | "yellow"
    | "blue"
    | "magenta"
    | "cyan"
    | "white";

export type LevelName = string;
export type EventName = string;

export type StoryTrackMode = "append" | "count" | "ignore";

export type StoryTrackRule = {
    mode?: StoryTrackMode;
    counter?: string;
    pick?: string[];
    redact?: string[];
};

export type StoryDefinition = {
    enabled?: boolean;
    correlationKey: string;
    trigger: EventName;
    ender?: EventName;
    track?: Record<EventName, StoryTrackRule>;
    maxAgeMs?: number;
    orphanStrategy?: "ignore" | "start";
};

export type LevelDefinition = {
    label?: string;
    colour?: ColourName;
    icon?: string;
    active?: boolean;
    minVerbosity?: number;
};

export type EventDefinition = {
    level: LevelName;
    active?: boolean;
    verbosity?: number;
    message?: string;
    redact?: string[];
};

export type GossamerUserConfig = {
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

export type TransportLogEntry = {
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

export type TransportStoryEntry = {
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
    // Summary fields for easier debugging
    /** Number of events in the timeline */
    event_count: number;
    /** First event name in the timeline */
    first_event?: string;
    /** Last event name in the timeline */
    last_event?: string;
    /** Whether any event in the timeline had an error level */
    has_error: boolean;
};

export type Transport = {
    log(entry: TransportLogEntry): void;
    story(entry: TransportStoryEntry): void;
    /**
     * Optional method to flush any buffered data.
     * Guaranteed to be called during graceful shutdown or manual flush.
     */
    flush?(): Promise<void>;
};

export type EmitOptions = {
    message?: string;
    verbosityOverride?: number;
};

/**
 * Timer object returned by gossamer.startTimer().
 * Call end() to emit the event with calculated duration_ms.
 */
export type Timer = {
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
export type SamplingStrategy = (entry: TransportLogEntry) => boolean;

export type GossamerInitOptions = {
    transports?: Transport[];
    /**
     * Sampling strategy for log events. If provided, each event is passed
     * to this function before being sent to transports. Return true to keep,
     * false to drop. If not provided, all events are kept.
     * 
     * Note: Stories are NOT affected by sampling - they always emit.
     */
    samplingStrategy?: SamplingStrategy;
    /**
     * If true, Gossamer will register global crash handlers for:
     * - uncaughtException
     * - unhandledRejection
     * - SIGTERM
     * - SIGINT
     * 
     * When a crash occurs, Gossamer will attempt to:
     * 1. Log a final "crash:event" with error details
     * 2. Flush all transports
     * 
     * Default: false
     */
    captureCrashes?: boolean;
};

export type GossamerResolvedConfig = {
    enabled: boolean;
    verbosity: number;

    levels: Record<LevelName, Required<LevelDefinition>>;
    events: Record<EventName, Required<EventDefinition>>;

    stories: Record<
        string,
        Required<StoryDefinition> & {
            _trackEvents: Set<EventName>;
            _allRelevantEvents: Set<EventName>;
        }
    >;

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