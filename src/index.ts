export { gossamer } from "./gossamer";

export type {
    EmitOptions,
    EventDefinition,
    GossamerInitOptions,
    GossamerResolvedConfig,
    GossamerUserConfig,
    LevelDefinition,
    SamplingStrategy,
    StoryDefinition,
    StoryTrackRule,
    Timer,
    Transport,
    TransportLogEntry,
    TransportStoryEntry,
} from "./core/types";

export { ConsolePrettyTransport } from "./transports/consolePrettyTransport";
export { FileTransport } from "./transports/fileTransport";
export { HttpTransport } from "./transports/httpTransport";
export { JsonStdoutTransport } from "./transports/jsonStdoutTransport";

export { validateConfig, assertValidConfig } from "./core/validateConfig";
export type { ValidationError, ValidationResult } from "./core/validateConfig";
