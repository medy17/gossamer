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
    level: string;
    event: string;
    message: string;
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
};

export type Transport = {
    log(entry: TransportLogEntry): void;
    story(entry: TransportStoryEntry): void;
};

export type EmitOptions = {
    message?: string;
    verbosityOverride?: number;
};

export type GossamerInitOptions = {
    transports?: Transport[];
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