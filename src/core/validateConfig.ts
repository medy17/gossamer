import type { GossamerUserConfig, StoryDefinition } from "./types";

export type ValidationError = {
    path: string;
    message: string;
    suggestion?: string;
};

export type ValidationResult = {
    valid: boolean;
    errors: ValidationError[];
};

/**
 * Known field names for typo detection
 */
const KNOWN_STORY_FIELDS = [
    "enabled",
    "correlationKey",
    "trigger",
    "ender",
    "track",
    "maxAgeMs",
    "orphanStrategy",
];

const KNOWN_EVENT_FIELDS = ["level", "active", "verbosity", "message", "redact"];

const KNOWN_LEVEL_FIELDS = ["label", "colour", "icon", "active", "minVerbosity"];

/**
 * Find similar string using Levenshtein distance
 */
function findSimilar(input: string, candidates: string[]): string | undefined {
    const inputLower = input.toLowerCase();

    for (const candidate of candidates) {
        const candidateLower = candidate.toLowerCase();

        // Exact match but different case
        if (inputLower === candidateLower && input !== candidate) {
            return candidate;
        }

        // Simple typo detection: off by one character
        if (Math.abs(input.length - candidate.length) <= 1) {
            let diff = 0;
            const shorter = input.length < candidate.length ? input : candidate;
            const longer = input.length >= candidate.length ? input : candidate;

            for (let i = 0; i < shorter.length; i++) {
                if (shorter[i] !== longer[i]) diff++;
            }

            if (diff <= 1) {
                return candidate;
            }
        }
    }

    return undefined;
}

/**
 * Validate a Gossamer user config and return helpful error messages.
 */
export function validateConfig(config: GossamerUserConfig): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate stories
    if (config.stories) {
        for (const [storyName, storyDef] of Object.entries(config.stories)) {
            const story = storyDef as StoryDefinition;
            const basePath = `stories.${storyName}`;

            // Check for required fields
            if (!story.correlationKey) {
                errors.push({
                    path: basePath,
                    message: `Missing required field: "correlationKey"`,
                });
            }

            if (!story.trigger) {
                errors.push({
                    path: basePath,
                    message: `Missing required field: "trigger"`,
                });
            }

            // Check for unknown fields (potential typos)
            for (const key of Object.keys(story)) {
                if (!KNOWN_STORY_FIELDS.includes(key)) {
                    const similar = findSimilar(key, KNOWN_STORY_FIELDS);
                    errors.push({
                        path: `${basePath}.${key}`,
                        message: `Unknown field: "${key}"`,
                        suggestion: similar ? `Did you mean "${similar}"?` : undefined,
                    });
                }
            }

            // Validate orphanStrategy values
            if (story.orphanStrategy && !["ignore", "start"].includes(story.orphanStrategy)) {
                errors.push({
                    path: `${basePath}.orphanStrategy`,
                    message: `Invalid value "${story.orphanStrategy}". Must be "ignore" or "start".`,
                });
            }
        }
    }

    // Validate events
    if (config.events) {
        for (const [eventName, eventDef] of Object.entries(config.events)) {
            const basePath = `events.${eventName}`;

            // Check required level field
            if (!eventDef.level) {
                errors.push({
                    path: basePath,
                    message: `Missing required field: "level"`,
                });
            }

            // Check for unknown fields
            for (const key of Object.keys(eventDef)) {
                if (!KNOWN_EVENT_FIELDS.includes(key)) {
                    const similar = findSimilar(key, KNOWN_EVENT_FIELDS);
                    errors.push({
                        path: `${basePath}.${key}`,
                        message: `Unknown field: "${key}"`,
                        suggestion: similar ? `Did you mean "${similar}"?` : undefined,
                    });
                }
            }
        }
    }

    // Validate levels
    if (config.levels) {
        for (const [levelName, levelDef] of Object.entries(config.levels)) {
            const basePath = `levels.${levelName}`;

            // Check for unknown fields
            for (const key of Object.keys(levelDef)) {
                if (!KNOWN_LEVEL_FIELDS.includes(key)) {
                    const similar = findSimilar(key, KNOWN_LEVEL_FIELDS);
                    errors.push({
                        path: `${basePath}.${key}`,
                        message: `Unknown field: "${key}"`,
                        suggestion: similar ? `Did you mean "${similar}"?` : undefined,
                    });
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validate config and throw if invalid.
 */
export function assertValidConfig(config: GossamerUserConfig): void {
    const result = validateConfig(config);

    if (!result.valid) {
        const messages = result.errors.map(err => {
            let msg = `  - ${err.path}: ${err.message}`;
            if (err.suggestion) {
                msg += ` (${err.suggestion})`;
            }
            return msg;
        });

        throw new Error(
            `Gossamer config validation failed:\n${messages.join("\n")}`
        );
    }
}
