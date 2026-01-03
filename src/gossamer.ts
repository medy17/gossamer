import { loadConfigFromFile } from "./core/loadConfig";
import { resolveConfig } from "./core/resolveConfig";
import type {
    EmitOptions,
    GossamerInitOptions,
    GossamerResolvedConfig,
    GossamerUserConfig,
    Transport,
} from "./core/types";
import { StoryEngine } from "./core/storyEngine";
import { ConsolePrettyTransport } from "./transports/consolePrettyTransport";

type QueuedEvent = {
    eventName: string;
    payload: Record<string, unknown>;
    options: EmitOptions | undefined;
};

class Gossamer {
    private initialised = false;
    private config: GossamerResolvedConfig | null = null;
    private transports: Transport[] = [];
    private storyEngine: StoryEngine | null = null;
    private queue: QueuedEvent[] = [];

    public async init(
        userConfig: GossamerUserConfig,
        options: GossamerInitOptions = {},
    ): Promise<void> {
        const resolved = resolveConfig(userConfig);

        this.config = resolved;
        this.transports = options.transports?.length
            ? options.transports
            : [new ConsolePrettyTransport({ pretty: true })];

        this.storyEngine?.stop();
        this.storyEngine = new StoryEngine(resolved, (storyEntry) => {
            for (const t of this.transports) {
                try {
                    t.story(storyEntry);
                } catch {
                    // Intentionally swallow transport errors.
                    // If logging explodes, your app shouldn't.
                }
            }
        });

        this.initialised = true;

        if (this.queue.length) {
            const queued = [...this.queue];
            this.queue = [];
            for (const q of queued) {
                this.emit(q.eventName, q.payload, q.options);
            }
        }
    }

    public async initFromFile(
        options: { path?: string } = {},
        initOptions: GossamerInitOptions = {},
    ): Promise<void> {
        const userConfig = await loadConfigFromFile(options.path);
        await this.init(userConfig, initOptions);
    }

    public emit(
        eventName: string,
        payload: Record<string, unknown> = {},
        options?: EmitOptions,
    ): void {
        if (!this.initialised || !this.config) {
            this.queue.push({ eventName, payload, options });
            return;
        }

        const cfg = this.config;
        if (!cfg.enabled) return;

        // --- LOGIC CHANGE IS HERE ---
        // First, always let the story engine see the event, because it
        // might want to track it even if it's too noisy to log.
        this.storyEngine?.process(eventName, payload);
        // ----------------------------

        const eventDef = cfg.events[eventName];

        // Unknown event logging behaviour
        if (!eventDef) {
            if (!cfg.unknownEvents.enabled) return;

            const fallbackLevel = cfg.unknownEvents.level;
            const entry = cfg.formatLogEntry({
                eventName,
                payload,
                level: fallbackLevel,
                message: options?.message,
            });

            for (const t of this.transports) {
                try {
                    t.log(entry);
                } catch {
                    // swallow
                }
            }
            return;
        }

        // Now, we check if we should PRINT to console
        if (!eventDef.active) return;

        const levelDef = cfg.levels[eventDef.level];
        if (!levelDef || !levelDef.active) return;

        const effectiveVerbosity =
            options?.verbosityOverride ?? eventDef.verbosity ?? 0;

        if (effectiveVerbosity > cfg.verbosity) {
            return; // Too chatty, fuck off
        }

        const entry = cfg.formatLogEntry({
            eventName,
            payload,
            level: eventDef.level,
            message: options?.message ?? eventDef.message,
            redact: eventDef.redact,
        });

        for (const t of this.transports) {
            try {
                t.log(entry);
            } catch {
                // swallow
            }
        }
    }

    public getConfig(): GossamerResolvedConfig | null {
        return this.config;
    }

    public isInitialised(): boolean {
        return this.initialised;
    }
}

export const gossamer = new Gossamer();