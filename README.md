<div align="center">
  <img src="readme-assets/logo.svg" width="120" alt="Gossamer Logo" />
  <h1>Gossamer</h1>
  <p><strong>Narrative Telemetry: Structured events + Config-driven stories.</strong></p>
</div>


Gossamer is a telemetry library designed to track "stories". Stories are cohesive narratives formed by a sequence of events. Unlike traditional logging which just dumps isolated events, Gossamer allows you to define the structure of a user journey (a "Story") and automatically tracks, correlates, and summarizes the events that make up that journey.

## Features

- **Story-based Tracking**: Define stories with a start trigger, tracking rules, and an end condition.
- **structured Events**: Everything is a structured event with payloads.
- **Config-Driven**: Define your tracking logic in a config file, not scattered throughout your code.
- **Pluggable Transports**: Send data to console, files, HTTP endpoints, or build your own.
- **Smart Sampling**: Sample noisy logs while ensuring critical stories are always fully captured.
- **Crash Handling**: Built-in optional crash reporting.

## Installation

```bash
npm install @dropsilk/gossamer
# or
pnpm add @dropsilk/gossamer
```

## Quick Start

### 1. Create a Config

Create a `gossamer.config.ts` (or `.js`, `.mjs`) in your project root:

```typescript
import type { GossamerUserConfig } from "@dropsilk/gossamer";

const config: GossamerUserConfig = {
    enabled: true,
    verbosity: 0,
    
    // Define log levels
    levels: {
        INFO: { active: true, label: "INFO", colour: "green" },
        ERROR: { active: true, label: "ERROR", colour: "red" },
    },

    // Define known events
    events: {
        "user:login": { level: "INFO" },
        "user:logout": { level: "INFO" },
        "order:create": { level: "INFO" },
        "order:complete": { level: "INFO" },
    },

    // Define Stories
    stories: {
        "UserSession": {
            enabled: true,
            correlationKey: "userId", // How to link events to this story
            trigger: "user:login",    // Event that starts the story
            ender: "user:logout",     // Event that ends the story
            track: {
                // Events to track within this story
                "order:create": { mode: "append" },
                "order:complete": { mode: "append" },
            }
        }
    }
};

export default config;
```

### 2. Initialize and Use

```typescript
import { gossamer } from "@dropsilk/gossamer";

async function main() {
    // Initialize (loads gossamer.config.ts automatically)
    await gossamer.initFromFile();

    // Emit events
    gossamer.emit("user:login", { userId: "123", name: "Alice" });

    gossamer.emit("order:create", { userId: "123", orderId: "A-1" });
    
    // This event is tracked as part of the "UserSession" story for user 123
    
    gossamer.emit("user:logout", { userId: "123" });
    // Story "UserSession" for user 123 is now complete and flushed to transports
}

main();
```

## Core Concepts

### Events
Basic unit of information. Emitted with a name and a payload.
```typescript
gossamer.emit("event:name", { key: "value" });
```

### Stories
A `Story` represents a lifecycle. It:
- Starts when a **trigger** event is observed.
- Uses a **correlationKey** (e.g., `requestId`, `userId`) to bind subsequent events to the story instance.
- **Tracks** specified events via rules (`append`, `count`, `ignore`).
- Ends when an **ender** event is observed or it times out.
- Is **Flushed** to transports as a single, cohesive `Trace` object containing the full timeline.

### Context
Global context that attaches to every emitted event (useful for request IDs, environment info, etc.).
```typescript
gossamer.setContext({ environment: "production" });

// 'environment: production' is now in every event payload
gossamer.emit("something", {}); 
```

### Transports
Where your data goes. Defaults to a pretty console output.
Available built-ins:
- `ConsolePrettyTransport`
- `JsonStdoutTransport`
- `FileTransport`
- `HttpTransport`

## Configuration Reference

See `src/core/types.ts` for full type definitions of `GossamerUserConfig`.
