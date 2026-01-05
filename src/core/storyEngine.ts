import type {
    GossamerResolvedConfig,
    StoryTrackRule,
    TransportStoryEntry,
} from "./types";
import { pickKeys, redactKeys } from "./sanitise";

type StoryInstance = {
    storyName: string;
    storyId: string;
    correlationKey: string;

    startTimeMs: number;
    lastUpdatedMs: number;

    status: "active" | "ended";

    meta: Record<string, unknown>;
    counters: Record<string, number>;
    timeline: Array<{
        timestamp: string;
        event: string;
        payload?: Record<string, unknown>;
    }>;
};

function makeStoryKey(storyName: string, storyId: string): string {
    return `${storyName}:${storyId}`;
}

function getStringId(value: unknown): string | null {
    if (typeof value === "string" && value.trim().length) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return null;
}

function applyTrackRule(
    story: StoryInstance,
    eventName: string,
    payload: Record<string, unknown>,
    rule: StoryTrackRule,
): void {
    const mode = rule.mode ?? "append";

    if (mode === "ignore") return;

    if (mode === "count") {
        const counter = rule.counter ?? eventName;
        story.counters[counter] = (story.counters[counter] ?? 0) + 1;
        return;
    }

    const picked = rule.pick ? pickKeys(payload, rule.pick) : payload;
    const safe = rule.redact ? redactKeys(picked, rule.redact) : picked;

    story.timeline.push({
        timestamp: new Date().toISOString(),
        event: eventName,
        payload: safe,
    });
}

export class StoryEngine {
    private cfg: GossamerResolvedConfig;
    private onFlush: (entry: TransportStoryEntry) => void;

    private active = new Map<string, StoryInstance>();
    private gcTimer: NodeJS.Timeout | null = null;

    public constructor(
        cfg: GossamerResolvedConfig,
        onFlush: (entry: TransportStoryEntry) => void,
    ) {
        this.cfg = cfg;
        this.onFlush = onFlush;

        // GC every 10 mins by default; lightweight, safe.
        this.gcTimer = setInterval(() => {
            this.cleanupStale();
        }, 10 * 60 * 1000);
    }

    public stop(): void {
        if (this.gcTimer) clearInterval(this.gcTimer);
        this.gcTimer = null;
    }

    public process(eventName: string, payload: Record<string, unknown>): void {
        const index = this.cfg.storyIndex;
        if (!index.storyRelatedEvents.has(eventName)) return;

        const storyNames = index.eventToStoryNames.get(eventName);
        if (!storyNames || !storyNames.size) return;

        for (const storyName of storyNames) {
            const storyDef = this.cfg.stories[storyName];
            if (!storyDef || !storyDef.enabled) continue;

            if (!storyDef._allRelevantEvents.has(eventName)) continue;

            const storyId = getStringId(payload[storyDef.correlationKey]);
            if (!storyId) continue;

            const key = makeStoryKey(storyName, storyId);
            const existing = this.active.get(key);

            // Trigger
            if (eventName === storyDef.trigger) {
                const now = Date.now();

                const story: StoryInstance = {
                    storyName,
                    storyId,
                    correlationKey: storyDef.correlationKey,
                    startTimeMs: now,
                    lastUpdatedMs: now,
                    status: "active",
                    meta: {
                        correlationKey: storyDef.correlationKey,
                        storyId,
                        storyName,
                        trigger: storyDef.trigger,
                    },
                    counters: {},
                    timeline: [
                        {
                            timestamp: new Date().toISOString(),
                            event: eventName,
                            payload,
                        },
                    ],
                };

                this.active.set(key, story);
                continue;
            }

            // Orphan strategy: tracked/ender events without story existing
            if (!existing) {
                if (storyDef.orphanStrategy !== "start") continue;

                const now = Date.now();
                const story: StoryInstance = {
                    storyName,
                    storyId,
                    correlationKey: storyDef.correlationKey,
                    startTimeMs: now,
                    lastUpdatedMs: now,
                    status: "active",
                    meta: {
                        correlationKey: storyDef.correlationKey,
                        storyId,
                        storyName,
                        trigger: "orphaned_start",
                    },
                    counters: {},
                    timeline: [],
                };

                this.active.set(key, story);
            }

            const story = this.active.get(key);
            if (!story) continue;

            story.lastUpdatedMs = Date.now();

            // Ender
            if (storyDef.ender && eventName === storyDef.ender) {
                story.timeline.push({
                    timestamp: new Date().toISOString(),
                    event: eventName,
                    payload,
                });

                this.flushStory(story, "complete");
                this.active.delete(key);
                continue;
            }

            // Track
            const rule = storyDef.track[eventName];
            if (!rule) continue;

            applyTrackRule(story, eventName, payload, rule);
        }
    }

    private flushStory(
        story: StoryInstance,
        status: "complete" | "stale" | "ended",
    ): void {
        const now = Date.now();

        // Compute summary fields
        const timeline = story.timeline;
        const event_count = timeline.length;
        const first_event = timeline.length > 0 ? timeline[0].event : undefined;
        const last_event = timeline.length > 0 ? timeline[timeline.length - 1].event : undefined;

        // Check for errors (look for ERROR level events or error in payload)
        const has_error = timeline.some(item => {
            // Check if event name contains "error" or "fail"
            const eventNameLower = item.event.toLowerCase();
            if (eventNameLower.includes("error") || eventNameLower.includes("fail")) {
                return true;
            }
            // Check if payload contains an error field
            if (item.payload && "error" in item.payload) {
                return true;
            }
            return false;
        });

        const entry: TransportStoryEntry = {
            timestamp: new Date().toISOString(),
            storyName: story.storyName,
            storyId: story.storyId,
            status,
            meta: story.meta,
            durationMs: Math.max(0, now - story.startTimeMs),
            counters: story.counters,
            timeline: story.timeline,
            // Summary fields
            event_count,
            first_event,
            last_event,
            has_error,
        };

        this.onFlush(entry);
    }

    private cleanupStale(): void {
        const now = Date.now();

        for (const [key, story] of this.active.entries()) {
            const storyDef = this.cfg.stories[story.storyName];
            if (!storyDef || !storyDef.enabled) {
                this.active.delete(key);
                continue;
            }

            const maxAgeMs = storyDef.maxAgeMs;
            if (now - story.startTimeMs > maxAgeMs) {
                this.flushStory(story, "stale");
                this.active.delete(key);
            }
        }
    }
}