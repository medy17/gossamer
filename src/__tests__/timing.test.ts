import { describe, it, expect, beforeEach, vi } from "vitest";
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

describe("Event Timing", () => {
    beforeEach(() => {
        gossamer.clearContext();
        vi.useFakeTimers();
    });

    it("should add duration_ms to timed events", async () => {
        vi.useRealTimers(); // Need real timers for this test

        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "db:query": { level: "INFO" } } },
            { transports: [transport] }
        );

        const timer = gossamer.startTimer("db:query", { table: "users" });

        // Wait a bit
        await new Promise((r) => setTimeout(r, 50));

        timer.end({ rows: 10 });

        expect(logs).toHaveLength(1);
        expect(logs[0].payload?.duration_ms).toBeGreaterThanOrEqual(50);
        expect(logs[0].payload?.table).toBe("users");
        expect(logs[0].payload?.rows).toBe(10);
    });

    it("should merge initial and additional payload", async () => {
        vi.useRealTimers();

        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "http:request": { level: "INFO" } } },
            { transports: [transport] }
        );

        const timer = gossamer.startTimer("http:request", {
            method: "GET",
            path: "/api/users",
        });

        timer.end({ status: 200, bytes: 1024 });

        expect(logs[0].payload).toMatchObject({
            method: "GET",
            path: "/api/users",
            status: 200,
            bytes: 1024,
        });
        expect(logs[0].payload?.duration_ms).toBeDefined();
    });

    it("should not emit when timer is cancelled", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "db:query": { level: "INFO" } } },
            { transports: [transport] }
        );

        const timer = gossamer.startTimer("db:query");
        timer.cancel();

        expect(logs).toHaveLength(0);
    });
});
