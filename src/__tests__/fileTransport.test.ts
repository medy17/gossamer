import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FileTransport } from "../transports/fileTransport";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("File Transport", () => {
    let tempDir: string;
    let logPath: string;
    let transport: FileTransport;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gossamer-test-"));
        logPath = path.join(tempDir, "test.log");
    });

    afterEach(async () => {
        if (transport) {
            await transport.close();
        }
        // Clean up temp directory
        if (fs.existsSync(logPath)) {
            fs.unlinkSync(logPath);
        }
        if (fs.existsSync(tempDir)) {
            fs.rmdirSync(tempDir);
        }
    });

    it("should write log entries as JSON lines", async () => {
        transport = new FileTransport({ path: logPath });

        transport.log({
            timestamp: "2024-01-01T00:00:00Z",
            event_id: "evt_123",
            level: "INFO",
            event: "test:event",
            message: "Test message",
            payload: { key: "value" },
        });

        await transport.close();

        const content = fs.readFileSync(logPath, "utf-8");
        const lines = content.trim().split("\n");
        expect(lines).toHaveLength(1);

        const parsed = JSON.parse(lines[0]);
        expect(parsed.type).toBe("event");
        expect(parsed.level).toBe("INFO");
        expect(parsed.event).toBe("test:event");
    });

    it("should write story entries", async () => {
        transport = new FileTransport({ path: logPath });

        transport.story({
            timestamp: "2024-01-01T00:00:00Z",
            storyName: "test_story",
            storyId: "story_123",
            status: "complete",
            meta: {},
            durationMs: 1000,
            counters: {},
            timeline: [],
            event_count: 0,
            has_error: false,
        });

        await transport.close();

        const content = fs.readFileSync(logPath, "utf-8");
        const parsed = JSON.parse(content.trim());
        expect(parsed.type).toBe("story");
        expect(parsed.storyName).toBe("test_story");
    });

    it("should create directories if they don't exist", async () => {
        const nestedPath = path.join(tempDir, "nested", "dir", "test.log");
        transport = new FileTransport({ path: nestedPath });

        transport.log({
            timestamp: "2024-01-01T00:00:00Z",
            event_id: "evt_123",
            level: "INFO",
            event: "test",
            message: "test",
        });

        expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);

        // Close transport before cleaning up - this flushes the write stream
        await transport.close();

        // Clean up nested directories
        if (fs.existsSync(nestedPath)) {
            fs.unlinkSync(nestedPath);
        }
        fs.rmdirSync(path.join(tempDir, "nested", "dir"));
        fs.rmdirSync(path.join(tempDir, "nested"));
    });

    it("should append by default", async () => {
        transport = new FileTransport({ path: logPath });

        transport.log({
            timestamp: "2024-01-01T00:00:00Z",
            event_id: "evt_1",
            level: "INFO",
            event: "first",
            message: "first",
        });

        await transport.close();

        // Create new transport to same file
        transport = new FileTransport({ path: logPath });

        transport.log({
            timestamp: "2024-01-01T00:00:01Z",
            event_id: "evt_2",
            level: "INFO",
            event: "second",
            message: "second",
        });

        await transport.close();

        const content = fs.readFileSync(logPath, "utf-8");
        const lines = content.trim().split("\n");
        expect(lines).toHaveLength(2);
    });
});
