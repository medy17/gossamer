import { describe, it, expect, beforeEach, vi } from "vitest";
import { gossamer } from "../gossamer";
import type { Transport, TransportLogEntry, TransportStoryEntry } from "../core/types";

// Mock transport to capture emitted entries
function createMockTransport() {
    const logs: TransportLogEntry[] = [];
    const stories: TransportStoryEntry[] = [];

    const transport: Transport = {
        log: (entry) => logs.push(entry),
        story: (entry) => stories.push(entry),
    };

    return { transport, logs, stories };
}

describe("Context Provider API", () => {
    beforeEach(async () => {
        // Reset gossamer state between tests by re-initializing
        gossamer.clearContext();
    });

    it("should merge context into emitted events", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "test:event": { level: "INFO" } } },
            { transports: [transport] }
        );

        gossamer.setContext({ user_id: "user_123", env: "test" });
        gossamer.emit("test:event", { action: "click" });

        expect(logs).toHaveLength(1);
        expect(logs[0].payload).toMatchObject({
            user_id: "user_123",
            env: "test",
            action: "click",
        });
    });

    it("should allow payload to override context", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "test:event": { level: "INFO" } } },
            { transports: [transport] }
        );

        gossamer.setContext({ user_id: "context_user" });
        gossamer.emit("test:event", { user_id: "payload_user" });

        expect(logs[0].payload?.user_id).toBe("payload_user");
    });

    it("should clear context with clearContext()", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "test:event": { level: "INFO" } } },
            { transports: [transport] }
        );

        gossamer.setContext({ user_id: "user_123" });
        gossamer.clearContext();
        gossamer.emit("test:event", { action: "click" });

        expect(logs[0].payload).not.toHaveProperty("user_id");
    });

    it("should scope context with withContext()", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "test:event": { level: "INFO" } } },
            { transports: [transport] }
        );

        gossamer.setContext({ global: "value" });

        gossamer.withContext({ scoped: "temp" }, () => {
            gossamer.emit("test:event", { inside: true });
        });

        gossamer.emit("test:event", { outside: true });

        // First emit should have both global and scoped
        expect(logs[0].payload).toMatchObject({ global: "value", scoped: "temp", inside: true });

        // Second emit should only have global
        expect(logs[1].payload).toMatchObject({ global: "value", outside: true });
        expect(logs[1].payload).not.toHaveProperty("scoped");
    });

    it("should restore context even if function throws", async () => {
        const { transport, logs } = createMockTransport();

        await gossamer.init(
            { enabled: true, events: { "test:event": { level: "INFO" } } },
            { transports: [transport] }
        );

        gossamer.setContext({ preserved: true });

        try {
            gossamer.withContext({ temporary: true }, () => {
                throw new Error("test error");
            });
        } catch {
            // expected
        }

        gossamer.emit("test:event", {});

        // Context should be restored
        expect(logs[0].payload).toMatchObject({ preserved: true });
        expect(logs[0].payload).not.toHaveProperty("temporary");
    });
});
