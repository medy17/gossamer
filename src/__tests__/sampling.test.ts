import { describe, it, expect, beforeEach } from "vitest";
import { gossamer } from "../gossamer";
import type { Transport, TransportLogEntry, TransportStoryEntry, SamplingStrategy } from "../core/types";

function createMockTransport() {
    const logs: TransportLogEntry[] = [];
    const stories: TransportStoryEntry[] = [];

    const transport: Transport = {
        log: (entry) => logs.push(entry),
        story: (entry) => stories.push(entry),
    };

    return { transport, logs, stories };
}

describe("Tail Sampling Strategy", () => {
    beforeEach(() => {
        gossamer.clearContext();
    });

    it("should drop events when sampling strategy returns false", async () => {
        const { transport, logs } = createMockTransport();

        const samplingStrategy: SamplingStrategy = () => false;

        await gossamer.init(
            { enabled: true, events: { "test:event": { level: "INFO" } } },
            { transports: [transport], samplingStrategy }
        );

        gossamer.emit("test:event", {});

        expect(logs).toHaveLength(0);
    });

    it("should keep events when sampling strategy returns true", async () => {
        const { transport, logs } = createMockTransport();

        const samplingStrategy: SamplingStrategy = () => true;

        await gossamer.init(
            { enabled: true, events: { "test:event": { level: "INFO" } } },
            { transports: [transport], samplingStrategy }
        );

        gossamer.emit("test:event", {});

        expect(logs).toHaveLength(1);
    });

    it("should always keep error level events with typical strategy", async () => {
        const { transport, logs } = createMockTransport();

        const samplingStrategy: SamplingStrategy = (entry) => {
            if (entry.level === "ERROR") return true;
            return false;
        };

        await gossamer.init(
            {
                enabled: true,
                events: {
                    "test:info": { level: "INFO" },
                    "test:error": { level: "ERROR" },
                },
            },
            { transports: [transport], samplingStrategy }
        );

        gossamer.emit("test:info", {});
        gossamer.emit("test:error", {});

        expect(logs).toHaveLength(1);
        expect(logs[0].level).toBe("ERROR");
    });

    it("should allow runtime sampling strategy changes", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "test:event": { level: "INFO" } } },
            { transports: [transport] }
        );

        // No sampling - keep all
        gossamer.emit("test:event", { n: 1 });

        // Set sampling to drop all
        gossamer.setSamplingStrategy(() => false);
        gossamer.emit("test:event", { n: 2 });

        // Disable sampling
        gossamer.setSamplingStrategy(null);
        gossamer.emit("test:event", { n: 3 });

        expect(logs).toHaveLength(2);
        expect(logs[0].payload?.n).toBe(1);
        expect(logs[1].payload?.n).toBe(3);
    });
});
