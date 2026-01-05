import { loadConfigFromFile } from "./core/loadConfig";
import { resolveConfig } from "./core/resolveConfig";
import type {
    EmitOptions,
    GossamerInitOptions,
    GossamerResolvedConfig,
    GossamerUserConfig,
    SamplingStrategy,
    Timer,
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
    private context: Record<string, unknown> = {};
    private samplingStrategy: SamplingStrategy | null = null;

    public async init(
        userConfig: GossamerUserConfig,
        options: GossamerInitOptions = {},
    ): Promise<void> {
        const resolved = resolveConfig(userConfig);

        this.config = resolved;
        this.transports = options.transports?.length
            ? options.transports
            : [new ConsolePrettyTransport({ pretty: true })];
        this.samplingStrategy = options.samplingStrategy ?? null;

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
        // Merge ambient context with payload (payload values take precedence)
        const mergedPayload = { ...this.context, ...payload };

        if (!this.initialised || !this.config) {
            this.queue.push({ eventName, payload: mergedPayload, options });
            return;
        }

        const cfg = this.config;
        if (!cfg.enabled) return;

        // --- LOGIC CHANGE IS HERE ---
        // First, always let the story engine see the event, because it
        // might want to track it even if it's too noisy to log.
        this.storyEngine?.process(eventName, mergedPayload);
        // ----------------------------

        const eventDef = cfg.events[eventName];

        // Unknown event logging behaviour
        if (!eventDef) {
            if (!cfg.unknownEvents.enabled) return;

            const fallbackLevel = cfg.unknownEvents.level;
            const entry = cfg.formatLogEntry({
                eventName,
                payload: mergedPayload,
                level: fallbackLevel,
                message: options?.message,
            });

            // Apply sampling strategy if configured
            if (this.samplingStrategy && !this.samplingStrategy(entry)) {
                return; // Sampled out
            }

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
            payload: mergedPayload,
            level: eventDef.level,
            message: options?.message ?? eventDef.message,
            redact: eventDef.redact,
        });

        // Apply sampling strategy if configured
        if (this.samplingStrategy && !this.samplingStrategy(entry)) {
            return; // Sampled out
        }

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

    /**
     * Set ambient context that will be merged into all emitted events.
     * Merges with existing context (does not replace).
     */
    public setContext(ctx: Record<string, unknown>): void {
        this.context = { ...this.context, ...ctx };
    }

    /**
     * Clear all ambient context.
     */
    public clearContext(): void {
        this.context = {};
    }

    /**
     * Get a copy of the current ambient context.
     */
    public getContext(): Record<string, unknown> {
        return { ...this.context };
    }

    /**
     * Execute a function with temporary additional context.
     * The temporary context is merged on top of existing context for the duration.
     * After the function completes (or throws), context is restored.
     */
    public withContext<T>(
        tempContext: Record<string, unknown>,
        fn: () => T,
    ): T {
        const previousContext = { ...this.context };
        this.context = { ...this.context, ...tempContext };

        try {
            return fn();
        } finally {
            this.context = previousContext;
        }
    }

    /**
     * Async version of withContext for async functions.
     */
    public async withContextAsync<T>(
        tempContext: Record<string, unknown>,
        fn: () => Promise<T>,
    ): Promise<T> {
        const previousContext = { ...this.context };
        this.context = { ...this.context, ...tempContext };

        try {
            return await fn();
        } finally {
            this.context = previousContext;
        }
    }

    /**
     * Set a sampling strategy at runtime.
     * Pass null to disable sampling (keep all events).
     */
    public setSamplingStrategy(strategy: SamplingStrategy | null): void {
        this.samplingStrategy = strategy;
    }

    /**
     * Start a timer for measuring event duration.
     * Call timer.end() to emit the event with duration_ms automatically calculated.
     * 
     * @example
     * const timer = gossamer.startTimer("db:query");
     * await runQuery();
     * timer.end({ rows: 42 }); // Emits with duration_ms
     */
    public startTimer(
        eventName: string,
        initialPayload: Record<string, unknown> = {},
    ): Timer {
        const startTime = Date.now();
        return {
            end: (additionalPayload: Record<string, unknown> = {}, options?: EmitOptions) => {
                const duration_ms = Date.now() - startTime;
                this.emit(eventName, {
                    ...initialPayload,
                    ...additionalPayload,
                    duration_ms,
                }, options);
            },
            /**
             * Cancel the timer without emitting an event.
             */
            cancel: () => {
                // No-op, but provides explicit API for discarding a timer
            },
        };
    }

    /**
     * Emit an error event with standardized error payload.
     * Automatically extracts name, message, code, and stack from the error.
     * 
     * @example
     * try { ... } catch (err) {
     *   gossamer.emitError("order:failed", err, { order_id: "123" });
     * }
     */
    public emitError(
        eventName: string,
        error: unknown,
        additionalPayload: Record<string, unknown> = {},
        options?: EmitOptions,
    ): void {
        const errorPayload = this.normalizeError(error);
        this.emit(eventName, {
            ...additionalPayload,
            error: errorPayload,
        }, options);
    }

    /**
     * Normalize an error into a standardized payload object.
     */
    private normalizeError(error: unknown): Record<string, unknown> {
        if (error instanceof Error) {
            const normalized: Record<string, unknown> = {
                name: error.name,
                message: error.message,
            };

            // Extract common error properties
            if ("code" in error && error.code !== undefined) {
                normalized.code = error.code;
            }
            if ("statusCode" in error && error.statusCode !== undefined) {
                normalized.statusCode = error.statusCode;
            }
            if ("status" in error && error.status !== undefined) {
                normalized.status = error.status;
            }

            // Include stack in development, omit in production by default
            // Users can override via redact config if needed
            if (error.stack) {
                normalized.stack = error.stack;
            }

            // Extract cause if present (ES2022+)
            if ("cause" in error && error.cause !== undefined) {
                normalized.cause = this.normalizeError(error.cause);
            }

            return normalized;
        }

        // Handle non-Error objects
        if (typeof error === "string") {
            return { message: error };
        }

        if (typeof error === "object" && error !== null) {
            return { raw: error };
        }

        return { message: String(error) };
    }
}

export const gossamer = new Gossamer();