import type {
    EventDefinition,
    GossamerResolvedConfig,
    GossamerUserConfig,
    LevelDefinition,
    LevelName,
    TransportLogEntry,
} from "./types";
import { redactKeys } from "./sanitise";

const DEFAULT_LEVELS: Record<string, Required<LevelDefinition>> = {
    INFO: {
        label: "INFO",
        colour: "cyan",
        icon: "i",
        active: true,
        minVerbosity: 0,
    },
    WARN: {
        label: "WARN",
        colour: "yellow",
        icon: "!",
        active: true,
        minVerbosity: 0,
    },
    ERROR: {
        label: "ERROR",
        colour: "red",
        icon: "x",
        active: true,
        minVerbosity: 0,
    },
};

const DEFAULT_UNKNOWN_LEVEL: LevelName = "WARN";

function normaliseLevel(
    name: string,
    input?: LevelDefinition,
): Required<LevelDefinition> {
    const base = DEFAULT_LEVELS[name] ?? {
        label: name,
        colour: "white",
        icon: "",
        active: true,
        minVerbosity: 0,
    };

    return {
        label: input?.label ?? base.label,
        colour: input?.colour ?? base.colour,
        icon: input?.icon ?? base.icon,
        active: input?.active ?? base.active,
        minVerbosity: input?.minVerbosity ?? base.minVerbosity,
    };
}

function normaliseEvent(input: EventDefinition): Required<EventDefinition> {
    return {
        level: input.level,
        active: input.active ?? true,
        verbosity: input.verbosity ?? 0,
        message: input.message ?? "",
        redact: input.redact ?? [],
    };
}

export function resolveConfig(
    user: GossamerUserConfig,
): GossamerResolvedConfig {
    const enabled = user.enabled ?? true;
    const verbosity = user.verbosity ?? 0;

    const levelsInput = user.levels ?? {};
    const levels: Record<string, Required<LevelDefinition>> = {};

    // Include defaults first
    for (const [name, def] of Object.entries(DEFAULT_LEVELS)) {
        levels[name] = normaliseLevel(name, def);
    }

    // Overlay user levels
    for (const [name, def] of Object.entries(levelsInput)) {
        levels[name] = normaliseLevel(name, def);
    }

    const eventsInput = user.events ?? {};
    const events: Record<string, Required<EventDefinition>> = {};
    for (const [eventName, def] of Object.entries(eventsInput)) {
        events[eventName] = normaliseEvent(def);
    }

    const unknownEvents = {
        enabled: user.unknownEvents?.enabled ?? true,
        level: user.unknownEvents?.level ?? DEFAULT_UNKNOWN_LEVEL,
    };

    // Normalise stories + precompute indices
    const storiesInput = user.stories ?? {};
    const stories: GossamerResolvedConfig["stories"] = {};

    const eventToStoryNames = new Map<string, Set<string>>();
    const storyRelatedEvents = new Set<string>();

    for (const [storyName, storyDefInput] of Object.entries(storiesInput)) {
        const enabledStory = storyDefInput.enabled ?? true;
        const correlationKey = storyDefInput.correlationKey;
        const trigger = storyDefInput.trigger;
        const ender = storyDefInput.ender ?? "";
        const track = storyDefInput.track ?? {};
        const maxAgeMs = storyDefInput.maxAgeMs ?? 2 * 60 * 60 * 1000;
        const orphanStrategy = storyDefInput.orphanStrategy ?? "ignore";

        const trackEvents = new Set<string>(Object.keys(track));
        const allRelevantEvents = new Set<string>([trigger]);

        if (ender) allRelevantEvents.add(ender);
        for (const ev of trackEvents) allRelevantEvents.add(ev);

        stories[storyName] = {
            enabled: enabledStory,
            correlationKey,
            trigger,
            ender,
            track,
            maxAgeMs,
            orphanStrategy,
            _trackEvents: trackEvents,
            _allRelevantEvents: allRelevantEvents,
        };

        if (!enabledStory) continue;

        for (const ev of allRelevantEvents) {
            storyRelatedEvents.add(ev);

            const current = eventToStoryNames.get(ev) ?? new Set<string>();
            current.add(storyName);
            eventToStoryNames.set(ev, current);
        }
    }

    const formatLogEntry = (input: {
        eventName: string;
        payload: Record<string, unknown>;
        level: LevelName;
        message?: string;
        redact?: string[];
    }): TransportLogEntry => {
        const message =
            (input.message && input.message.trim().length)
                ? input.message
                : input.eventName;

        const levelDef = levels[input.level];
        const minVerbosity = levelDef?.minVerbosity ?? 0;

        const entryVerbosity = Math.max(minVerbosity, 0);

        const safePayload =
            input.redact && input.redact.length
                ? redactKeys(input.payload, input.redact)
                : input.payload;

        return {
            timestamp: new Date().toISOString(),
            level: input.level,
            event: input.eventName,
            message,
            payload: entryVerbosity >= 0 ? safePayload : undefined,
        };
    };

    return {
        enabled,
        verbosity,
        levels,
        events,
        stories,
        storyIndex: {
            eventToStoryNames,
            storyRelatedEvents,
        },
        unknownEvents,
        formatLogEntry,
    };
}