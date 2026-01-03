# @dropsilk/gossamer

Gossamer is config-driven narrative telemetry: emit structured events, optionally
compile them into "stories" (correlated timelines) automatically.

## Install

```bash
npm install @dropsilk/gossamer
```

## Quick start (recommended: gossamer.config.js with types)

Create `gossamer.config.js` at your project root:

```js
/** @type {import("@dropsilk/gossamer").GossamerUserConfig} */
module.exports = {
  enabled: true,
  verbosity: 1,

  levels: {
    INFO: { colour: "cyan", icon: "i", active: true, minVerbosity: 0 },
    WARN: { colour: "yellow", icon: "!", active: true, minVerbosity: 0 },
    ERROR: { colour: "red", icon: "x", active: true, minVerbosity: 0 },
    NOISY: { colour: "grey", icon: ".", active: true, minVerbosity: 2 }
  },

  events: {
    "system:startup": { level: "INFO" },
    "system:heartbeat": { level: "NOISY" },
    "flight:created": { level: "INFO" },
    "flight:joined": { level: "INFO" },
    "flight:signal": { level: "NOISY" },
    "flight:ended": { level: "INFO" }
  },

  stories: {
    flight_story: {
      enabled: true,
      correlationKey: "flightCode",
      trigger: "flight:created",
      ender: "flight:ended",
      maxAgeMs: 2 * 60 * 60 * 1000,
      orphanStrategy: "ignore",
      track: {
        "flight:joined": { mode: "append", pick: ["joinerId", "joinerName"] },
        "flight:signal": { mode: "count", counter: "signals" }
      }
    }
  }
};
```

In your app entry point:

```js
const { gossamer } = require("@dropsilk/gossamer");

async function main() {
  await gossamer.initFromFile();
  gossamer.emit("system:startup", { port: 8080 });

  // Later, anywhere:
  gossamer.emit("flight:created", { flightCode: "ABC123", creatorId: "u1" });
}

main();
```

## API

- `await gossamer.init(config, options?)`
- `await gossamer.initFromFile({ path? })`
- `gossamer.emit(eventName, payload?, emitOptions?)`

## Notes

- If you insist on `gossamer.config.ts`, it works because Gossamer loads it via
  `jiti`. Still, `gossamer.config.js` is simpler and less fussy in production.
