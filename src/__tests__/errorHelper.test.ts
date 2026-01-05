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

describe("Error Capture Helper", () => {
    beforeEach(() => {
        gossamer.clearContext();
    });

    it("should serialize Error objects correctly", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "order:failed": { level: "ERROR" } } },
            { transports: [transport] }
        );

        const error = new Error("Something went wrong");
        gossamer.emitError("order:failed", error, { order_id: "123" });

        expect(logs).toHaveLength(1);
        expect(logs[0].payload?.order_id).toBe("123");
        expect(logs[0].payload?.error).toMatchObject({
            name: "Error",
            message: "Something went wrong",
        });
        expect((logs[0].payload?.error as Record<string, unknown>).stack).toBeDefined();
    });

    it("should extract error code if present", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "db:error": { level: "ERROR" } } },
            { transports: [transport] }
        );

        const error = new Error("Connection failed") as Error & { code: string };
        error.code = "ECONNREFUSED";
        gossamer.emitError("db:error", error);

        expect((logs[0].payload?.error as Record<string, unknown>).code).toBe("ECONNREFUSED");
    });

    it("should handle nested cause errors", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "api:error": { level: "ERROR" } } },
            { transports: [transport] }
        );

        const rootCause = new Error("Network timeout");
        const error = new Error("Failed to fetch user", { cause: rootCause });
        gossamer.emitError("api:error", error);

        const errorPayload = logs[0].payload?.error as Record<string, unknown>;
        expect(errorPayload.cause).toMatchObject({
            name: "Error",
            message: "Network timeout",
        });
    });

    it("should handle string errors", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "generic:error": { level: "ERROR" } } },
            { transports: [transport] }
        );

        gossamer.emitError("generic:error", "Something bad happened");

        expect((logs[0].payload?.error as Record<string, unknown>).message).toBe(
            "Something bad happened"
        );
    });

    it("should handle non-Error objects", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "weird:error": { level: "ERROR" } } },
            { transports: [transport] }
        );

        gossamer.emitError("weird:error", { custom: "error object" });

        expect((logs[0].payload?.error as Record<string, unknown>).raw).toMatchObject({
            custom: "error object",
        });
    });
});
