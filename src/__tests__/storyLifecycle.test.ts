import { describe, it, expect, beforeEach } from "vitest";
import { gossamer } from "../gossamer";
import type { Transport, TransportLogEntry, TransportStoryEntry } from "../core/types";

function createMockTransport() {
    const logs: TransportLogEntry[] = [];
    const stories: TransportStoryEntry[] = [];

    const transport: Transport = {
        log: (entry) => logs.push(entry),
        story: (entry) => stories.push(entry),
    };

    return { transport, logs, stories };
}

describe("Story Lifecycle", () => {
    beforeEach(() => {
        gossamer.clearContext();
    });

    it("should track a complete story lifecycle with summary fields", async () => {
        const { transport, stories } = createMockTransport();

        await gossamer.init(
            {
                enabled: true,
                events: {
                    "order:started": { level: "INFO" },
                    "order:item_added": { level: "INFO" },
                    "order:completed": { level: "INFO" },
                },
                stories: {
                    order_flow: {
                        correlationKey: "order_id",
                        trigger: "order:started",
                        ender: "order:completed",
                        // Track format: Record<EventName, StoryTrackRule>
                        track: {
                            "order:item_added": {}, // Default mode is "append"
                        },
                    },
                },
            },
            { transports: [transport] }
        );

        // Start the story (trigger adds to timeline automatically)
        gossamer.emit("order:started", { order_id: "order_123", customer: "john" });

        // Add some events (tracked via track rules)
        gossamer.emit("order:item_added", { order_id: "order_123", item: "widget" });
        gossamer.emit("order:item_added", { order_id: "order_123", item: "gadget" });

        // Complete the story (ender adds to timeline automatically)
        gossamer.emit("order:completed", { order_id: "order_123", total: 99.99 });

        // Give the story engine time to flush
        await new Promise((r) => setTimeout(r, 50));

        expect(stories).toHaveLength(1);

        const story = stories[0];
        expect(story.storyName).toBe("order_flow");
        expect(story.status).toBe("complete");
        expect(story.event_count).toBe(4); // trigger + 2 items + ender
        expect(story.first_event).toBe("order:started");
        expect(story.last_event).toBe("order:completed");
        expect(story.has_error).toBe(false);
        expect(story.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should detect errors in story timeline by event name", async () => {
        const { transport, stories } = createMockTransport();

        await gossamer.init(
            {
                enabled: true,
                events: {
                    "payment:started": { level: "INFO" },
                    "payment:failed": { level: "ERROR" },
                    "payment:completed": { level: "INFO" },
                },
                stories: {
                    payment_flow: {
                        correlationKey: "payment_id",
                        trigger: "payment:started",
                        ender: "payment:completed",
                        track: {
                            "payment:failed": {},
                        },
                    },
                },
            },
            { transports: [transport] }
        );

        gossamer.emit("payment:started", { payment_id: "pay_1" });
        gossamer.emit("payment:failed", { payment_id: "pay_1", reason: "Card declined" });
        gossamer.emit("payment:completed", { payment_id: "pay_1" });

        await new Promise((r) => setTimeout(r, 50));

        expect(stories).toHaveLength(1);
        // "failed" contains "fail" → has_error should be true
        expect(stories[0].has_error).toBe(true);
    });

    it("should detect errors when payload contains error field", async () => {
        const { transport, stories } = createMockTransport();

        await gossamer.init(
            {
                enabled: true,
                events: {
                    "job:started": { level: "INFO" },
                    "job:step": { level: "INFO" },
                    "job:done": { level: "INFO" },
                },
                stories: {
                    job_flow: {
                        correlationKey: "job_id",
                        trigger: "job:started",
                        ender: "job:done",
                        track: {
                            "job:step": {},
                        },
                    },
                },
            },
            { transports: [transport] }
        );

        gossamer.emit("job:started", { job_id: "j1" });
        gossamer.emit("job:step", { job_id: "j1", error: { message: "Something went wrong" } });
        gossamer.emit("job:done", { job_id: "j1" });

        await new Promise((r) => setTimeout(r, 50));

        expect(stories).toHaveLength(1);
        expect(stories[0].has_error).toBe(true);
    });

    it("should track counters via count mode", async () => {
        const { transport, stories } = createMockTransport();

        await gossamer.init(
            {
                enabled: true,
                events: {
                    "batch:start": { level: "INFO" },
                    "batch:item": { level: "INFO" },
                    "batch:done": { level: "INFO" },
                },
                stories: {
                    batch_process: {
                        correlationKey: "batch_id",
                        trigger: "batch:start",
                        ender: "batch:done",
                        track: {
                            "batch:item": { mode: "count", counter: "items_processed" },
                        },
                    },
                },
            },
            { transports: [transport] }
        );

        gossamer.emit("batch:start", { batch_id: "b1" });
        gossamer.emit("batch:item", { batch_id: "b1", item_id: 1 });
        gossamer.emit("batch:item", { batch_id: "b1", item_id: 2 });
        gossamer.emit("batch:item", { batch_id: "b1", item_id: 3 });
        gossamer.emit("batch:done", { batch_id: "b1" });

        await new Promise((r) => setTimeout(r, 50));

        expect(stories).toHaveLength(1);
        expect(stories[0].counters.items_processed).toBe(3);
        // Count mode doesn't add to timeline - only trigger + ender
        expect(stories[0].event_count).toBe(2);
    });

    it("should include meta from the story configuration", async () => {
        const { transport, stories } = createMockTransport();

        await gossamer.init(
            {
                enabled: true,
                events: {
                    "request:start": { level: "INFO" },
                    "request:end": { level: "INFO" },
                },
                stories: {
                    request_flow: {
                        correlationKey: "request_id",
                        trigger: "request:start",
                        ender: "request:end",
                    },
                },
            },
            { transports: [transport] }
        );

        gossamer.emit("request:start", { request_id: "req_abc", method: "GET" });
        gossamer.emit("request:end", { request_id: "req_abc", status: 200 });

        await new Promise((r) => setTimeout(r, 50));

        expect(stories).toHaveLength(1);
        // Meta contains story metadata
        expect(stories[0].meta.correlationKey).toBe("request_id");
        expect(stories[0].meta.storyId).toBe("req_abc");
        expect(stories[0].meta.storyName).toBe("request_flow");
    });
});
