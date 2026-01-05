<div align="center">
  <img src="readme-assets/logo.svg" width="120" alt="Gossamer Logo" />
  <h1>Gossamer</h1>
  <p><strong>Narrative Telemetry: Structured events + Config-driven stories.</strong></p>
</div>

# Architecture

Gossamer is built around a central event bus that routes events to a stateful Story Engine and stateless Transports.

```mermaid
graph TD
    UserCode[User Code] -->|emit(event, payload)| Gossamer
    
    subgraph Gossamer Core
        Gossamer -->|1. Process| StoryEngine[Story Engine]
        Gossamer -->|2. Log (if enabled)| Transports
        
        StoryEngine -- Flush (End/Timeout) --> Transports
    end
    
    subgraph Transports
        ConsolePretty
        File
        HTTP
        Others[...]
    end
    
    Transports --> Output[Logs & Traces]
```

## Core Components

### 1. Gossamer (`src/gossamer.ts`)
The main entry point/facade.
- **Responsibilities**:
    - Initialization and Config Loading.
    - Event Emission API (`emit`, `startTimer`, `emitError`).
    - Context Management (`setContext`).
    - Orchestrating the flow between Story Engine and Transports.
    - Crash Handling (Global standardizing of uncaught exceptions).

### 2. Story Engine (`src/core/storyEngine.ts`)
The stateful heart of the system.
- **Responsibilities**:
    - Maintains the set of "Active Stories" in memory.
    - Matches incoming events against defined Story Configs.
    - **Lifecycle Management**:
        - **Trigger**: Starts a new Story Instance when a trigger event is seen.
        - **Track**: Appends events to the story's timeline based on rules. or updates counters.
        - **Ender**: Detects completion events, flushes the story.
    - **Garbage Collection**: Periodically scans for stale stories (timed out) and flushes them as "stale".

### 3. Transports (`src/core/types.ts` & `src/transports/*`)
Pluggable output sinks.
- **Responsibilities**:
    - **`log(entry)`**: Handle individual event logs (like standard logging).
    - **`story(entry)`**: Handle completed/flushed stories (aggregate traces).
    - **`flush()`**: Ensure all buffered data is written (critical for graceful shutdowns).

### 4. Configuration System (`src/core/loadConfig.ts`, `resolveConfig.ts`)
- Config is defined in `gossamer.config.ts`.
- Loaded via `jiti` for seamless TS/JS support.
- Resolved and Validated to ensure all stories have valid references.

## Data Models

### Story Instance
An active story in memory looks like:
```typescript
{
    storyId: "123",           // Correlated ID (e.g. orderId)
    storyName: "OrderFlow",   // Type of story
    status: "active",
    timeline: [               // Ordered list of events
        { timestamp: "...", event: "order:created", payload: {...} },
        { timestamp: "...", event: "payment:success", payload: {...} }
    ],
    counters: { ... }         // Aggregated metrics
}
```

### Transport Entry
When a story completes, it generates a `TransportStoryEntry`. This is what gets logged/sent to your backend. It contains the full timeline plus summary metrics (duration, error status, etc.).

## Key Flows

### Event Emission Flow
1. User calls `gossamer.emit(name, payload)`.
2. Ambient context is merged into payload.
3. **Story Phase**: `StoryEngine.process()` is called.
    - Checks if event triggers, tracks, or ends any stories.
    - Updates in-memory state.
4. **Log Phase**:
    - Checks `events[name].level`.
    - Checks `verbosity`.
    - Checks `SamplingStrategy`.
    - If passed, calls `transport.log()`.

### Story Lifecycle Flow
1. **Start**: `trigger` event -> New Instance created in `active` map.
2. **Update**: `track` event -> Appended to `timeline`.
3. **End**: `ender` event -> Story marked "complete", sent to `transport.story()`, removed from `active`.
4. **Timeout**: GC Timer runs -> Checks `maxAgeMs` -> If old, sent to `transport.story()` as "stale", removed from `active`.
