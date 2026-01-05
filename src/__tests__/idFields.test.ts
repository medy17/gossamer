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

describe("First-Class ID Fields", () => {
    beforeEach(() => {
        gossamer.clearContext();
    });

    it("should extract request_id to first-class field", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "test:event": { level: "INFO" } } },
            { transports: [transport] }
        );

        gossamer.emit("test:event", { request_id: "req_123", data: "value" });

        expect(logs[0].request_id).toBe("req_123");
        // Should be removed from payload
        expect(logs[0].payload).not.toHaveProperty("request_id");
        expect(logs[0].payload).toHaveProperty("data", "value");
    });

    it("should extract trace_id and span_id", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "test:event": { level: "INFO" } } },
            { transports: [transport] }
        );

        gossamer.emit("test:event", {
            trace_id: "trace_abc",
            span_id: "span_xyz",
        });

        expect(logs[0].trace_id).toBe("trace_abc");
        expect(logs[0].span_id).toBe("span_xyz");
    });

    it("should include event_id in every log entry", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "test:event": { level: "INFO" } } },
            { transports: [transport] }
        );

        gossamer.emit("test:event", {});

        expect(logs[0].event_id).toBeDefined();
        expect(logs[0].event_id).toMatch(/^evt_/);
    });

    it("should generate unique event_ids", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "test:event": { level: "INFO" } } },
            { transports: [transport] }
        );

        gossamer.emit("test:event", {});
        gossamer.emit("test:event", {});

        expect(logs[0].event_id).not.toBe(logs[1].event_id);
    });
});
