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
    level: string;
    event: string;
    message: string;
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
};
type Transport = {
    log(entry: TransportLogEntry): void;
    story(entry: TransportStoryEntry): void;
};
type EmitOptions = {
    message?: string;
    verbosityOverride?: number;
};
type GossamerInitOptions = {
    transports?: Transport[];
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
    init(userConfig: GossamerUserConfig, options?: GossamerInitOptions): Promise<void>;
    initFromFile(options?: {
        path?: string;
    }, initOptions?: GossamerInitOptions): Promise<void>;
    emit(eventName: string, payload?: Record<string, unknown>, options?: EmitOptions): void;
    getConfig(): GossamerResolvedConfig | null;
    isInitialised(): boolean;
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

declare class JsonStdoutTransport implements Transport {
    log(entry: TransportLogEntry): void;
    story(entry: TransportStoryEntry): void;
}

export { ConsolePrettyTransport, type EmitOptions, type EventDefinition, type GossamerInitOptions, type GossamerResolvedConfig, type GossamerUserConfig, JsonStdoutTransport, type LevelDefinition, type StoryDefinition, type StoryTrackRule, type Transport, type TransportLogEntry, type TransportStoryEntry, gossamer };
