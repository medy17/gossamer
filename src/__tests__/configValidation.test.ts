import { describe, it, expect } from "vitest";
import { validateConfig, assertValidConfig } from "../core/validateConfig";
import type { GossamerUserConfig } from "../core/types";

describe("Config Validation", () => {
    it("should pass for valid config", () => {
        const config: GossamerUserConfig = {
            enabled: true,
            events: {
                "test:event": { level: "INFO" },
            },
            stories: {
                test_story: {
                    correlationKey: "id",
                    trigger: "start",
                    ender: "end",
                },
            },
        };

        const result = validateConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("should detect missing correlationKey in stories", () => {
        const config = {
            stories: {
                broken_story: {
                    trigger: "start",
                } as unknown,
            },
        } as GossamerUserConfig;

        const result = validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes("correlationKey"))).toBe(true);
    });

    it("should detect missing trigger in stories", () => {
        const config = {
            stories: {
                broken_story: {
                    correlationKey: "id",
                } as unknown,
            },
        } as GossamerUserConfig;

        const result = validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes("trigger"))).toBe(true);
    });

    it("should detect unknown fields in stories", () => {
        const config = {
            stories: {
                story_with_unknown: {
                    correlationKey: "id",
                    trigger: "start",
                    unknownField: "value", // Unknown field
                } as unknown,
            },
        } as GossamerUserConfig;

        const result = validateConfig(config);
        expect(result.valid).toBe(false);
        const unknownError = result.errors.find((e) => e.path.includes("unknownField"));
        expect(unknownError).toBeDefined();
        expect(unknownError?.message).toContain("Unknown field");
    });

    it("should suggest similar fields for typos", () => {
        const config = {
            stories: {
                typo_story: {
                    correlationKey: "id",
                    trigger: "start",
                    endr: "end", // typo for "ender" (only 1 char different)
                } as unknown,
            },
        } as GossamerUserConfig;

        const result = validateConfig(config);
        expect(result.valid).toBe(false);
        const typoError = result.errors.find((e) => e.path.includes("endr"));
        expect(typoError).toBeDefined();
        expect(typoError?.suggestion).toContain("ender");
    });

    it("should detect invalid orphanStrategy values", () => {
        // Using a separate cast to avoid TypeScript inference issues
        const storyDef = {
            correlationKey: "id",
            trigger: "start",
            orphanStrategy: "invalid",
        };

        const config = {
            stories: {
                bad_strategy: storyDef,
            },
        } as unknown as GossamerUserConfig;

        const result = validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes("Must be"))).toBe(true);
    });

    it("should detect missing level in events", () => {
        const config = {
            events: {
                no_level: {} as unknown,
            },
        } as GossamerUserConfig;

        const result = validateConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes("level"))).toBe(true);
    });

    it("assertValidConfig should throw on invalid config", () => {
        const config = {
            stories: {
                broken: {} as unknown,
            },
        } as GossamerUserConfig;

        expect(() => assertValidConfig(config)).toThrow("Gossamer config validation failed");
    });

    it("assertValidConfig should not throw on valid config", () => {
        const config: GossamerUserConfig = {
            enabled: true,
            events: { "test:event": { level: "INFO" } },
        };

        expect(() => assertValidConfig(config)).not.toThrow();
    });
});
