"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ConsolePrettyTransport: () => ConsolePrettyTransport,
  JsonStdoutTransport: () => JsonStdoutTransport,
  gossamer: () => gossamer
});
module.exports = __toCommonJS(index_exports);

// src/core/loadConfig.ts
var import_node_fs = __toESM(require("fs"), 1);
var import_node_path = __toESM(require("path"), 1);
function fileExists(p) {
  try {
    return import_node_fs.default.statSync(p).isFile();
  } catch {
    return false;
  }
}
function defaultConfigCandidates() {
  return [
    "gossamer.config.ts",
    "gossamer.config.js",
    "gossamer.config.cjs",
    "gossamer.config.mjs"
  ];
}
function resolveConfigPath(explicitPath) {
  if (explicitPath) return import_node_path.default.resolve(process.cwd(), explicitPath);
  for (const candidate of defaultConfigCandidates()) {
    const full = import_node_path.default.resolve(process.cwd(), candidate);
    if (fileExists(full)) return full;
  }
  throw new Error(
    [
      "Gossamer config not found.",
      "Looked for: gossamer.config.ts/js/cjs/mjs in project root.",
      "Either create one, or pass an explicit path to initFromFile({ path })."
    ].join(" ")
  );
}
async function loadConfigFromFile(explicitPath) {
  const configPath = resolveConfigPath(explicitPath);
  const { default: createJiti } = await import("jiti");
  const jiti = createJiti(process.cwd(), {
    interopDefault: true,
    esmResolve: true
  });
  const mod = jiti(configPath);
  const cfg = mod?.default !== void 0 ? mod.default : mod;
  if (!cfg || typeof cfg !== "object") {
    throw new Error(
      `Invalid Gossamer config at ${configPath}: expected an object export.`
    );
  }
  return cfg;
}

// src/core/sanitise.ts
function isObjectLike(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function redactKeys(payload, redact = []) {
  if (!redact.length) return payload;
  const out = { ...payload };
  for (const key of redact) {
    if (key in out) out[key] = "[REDACTED]";
  }
  for (const [k, v] of Object.entries(out)) {
    if (isObjectLike(v)) {
      out[k] = redactKeys(v, redact);
    }
  }
  return out;
}
function pickKeys(payload, keys = []) {
  if (!keys.length) return payload;
  const out = {};
  for (const k of keys) {
    if (k in payload) out[k] = payload[k];
  }
  return out;
}

// src/core/resolveConfig.ts
var DEFAULT_LEVELS = {
  INFO: {
    label: "INFO",
    colour: "cyan",
    icon: "i",
    active: true,
    minVerbosity: 0
  },
  WARN: {
    label: "WARN",
    colour: "yellow",
    icon: "!",
    active: true,
    minVerbosity: 0
  },
  ERROR: {
    label: "ERROR",
    colour: "red",
    icon: "x",
    active: true,
    minVerbosity: 0
  }
};
var DEFAULT_UNKNOWN_LEVEL = "WARN";
function normaliseLevel(name, input) {
  const base = DEFAULT_LEVELS[name] ?? {
    label: name,
    colour: "white",
    icon: "",
    active: true,
    minVerbosity: 0
  };
  return {
    label: input?.label ?? base.label,
    colour: input?.colour ?? base.colour,
    icon: input?.icon ?? base.icon,
    active: input?.active ?? base.active,
    minVerbosity: input?.minVerbosity ?? base.minVerbosity
  };
}
function normaliseEvent(input) {
  return {
    level: input.level,
    active: input.active ?? true,
    verbosity: input.verbosity ?? 0,
    message: input.message ?? "",
    redact: input.redact ?? []
  };
}
function resolveConfig(user) {
  const enabled = user.enabled ?? true;
  const verbosity = user.verbosity ?? 0;
  const levelsInput = user.levels ?? {};
  const levels = {};
  for (const [name, def] of Object.entries(DEFAULT_LEVELS)) {
    levels[name] = normaliseLevel(name, def);
  }
  for (const [name, def] of Object.entries(levelsInput)) {
    levels[name] = normaliseLevel(name, def);
  }
  const eventsInput = user.events ?? {};
  const events = {};
  for (const [eventName, def] of Object.entries(eventsInput)) {
    events[eventName] = normaliseEvent(def);
  }
  const unknownEvents = {
    enabled: user.unknownEvents?.enabled ?? true,
    level: user.unknownEvents?.level ?? DEFAULT_UNKNOWN_LEVEL
  };
  const storiesInput = user.stories ?? {};
  const stories = {};
  const eventToStoryNames = /* @__PURE__ */ new Map();
  const storyRelatedEvents = /* @__PURE__ */ new Set();
  for (const [storyName, storyDefInput] of Object.entries(storiesInput)) {
    const enabledStory = storyDefInput.enabled ?? true;
    const correlationKey = storyDefInput.correlationKey;
    const trigger = storyDefInput.trigger;
    const ender = storyDefInput.ender ?? "";
    const track = storyDefInput.track ?? {};
    const maxAgeMs = storyDefInput.maxAgeMs ?? 2 * 60 * 60 * 1e3;
    const orphanStrategy = storyDefInput.orphanStrategy ?? "ignore";
    const trackEvents = new Set(Object.keys(track));
    const allRelevantEvents = /* @__PURE__ */ new Set([trigger]);
    if (ender) allRelevantEvents.add(ender);
    for (const ev of trackEvents) allRelevantEvents.add(ev);
    stories[storyName] = {
      enabled: enabledStory,
      correlationKey,
      trigger,
      ender,
      track,
      maxAgeMs,
      orphanStrategy,
      _trackEvents: trackEvents,
      _allRelevantEvents: allRelevantEvents
    };
    if (!enabledStory) continue;
    for (const ev of allRelevantEvents) {
      storyRelatedEvents.add(ev);
      const current = eventToStoryNames.get(ev) ?? /* @__PURE__ */ new Set();
      current.add(storyName);
      eventToStoryNames.set(ev, current);
    }
  }
  const formatLogEntry = (input) => {
    const message = input.message && input.message.trim().length ? input.message : input.eventName;
    const levelDef = levels[input.level];
    const minVerbosity = levelDef?.minVerbosity ?? 0;
    const entryVerbosity = Math.max(minVerbosity, 0);
    const safePayload = input.redact && input.redact.length ? redactKeys(input.payload, input.redact) : input.payload;
    return {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level: input.level,
      event: input.eventName,
      message,
      payload: entryVerbosity >= 0 ? safePayload : void 0
    };
  };
  return {
    enabled,
    verbosity,
    levels,
    events,
    stories,
    storyIndex: {
      eventToStoryNames,
      storyRelatedEvents
    },
    unknownEvents,
    formatLogEntry
  };
}

// src/core/storyEngine.ts
function makeStoryKey(storyName, storyId) {
  return `${storyName}:${storyId}`;
}
function getStringId(value) {
  if (typeof value === "string" && value.trim().length) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
function applyTrackRule(story, eventName, payload, rule) {
  const mode = rule.mode ?? "append";
  if (mode === "ignore") return;
  if (mode === "count") {
    const counter = rule.counter ?? eventName;
    story.counters[counter] = (story.counters[counter] ?? 0) + 1;
    return;
  }
  const picked = rule.pick ? pickKeys(payload, rule.pick) : payload;
  const safe = rule.redact ? redactKeys(picked, rule.redact) : picked;
  story.timeline.push({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    event: eventName,
    payload: safe
  });
}
var StoryEngine = class {
  cfg;
  onFlush;
  active = /* @__PURE__ */ new Map();
  gcTimer = null;
  constructor(cfg, onFlush) {
    this.cfg = cfg;
    this.onFlush = onFlush;
    this.gcTimer = setInterval(() => {
      this.cleanupStale();
    }, 10 * 60 * 1e3);
  }
  stop() {
    if (this.gcTimer) clearInterval(this.gcTimer);
    this.gcTimer = null;
  }
  process(eventName, payload) {
    const index = this.cfg.storyIndex;
    if (!index.storyRelatedEvents.has(eventName)) return;
    const storyNames = index.eventToStoryNames.get(eventName);
    if (!storyNames || !storyNames.size) return;
    for (const storyName of storyNames) {
      const storyDef = this.cfg.stories[storyName];
      if (!storyDef || !storyDef.enabled) continue;
      if (!storyDef._allRelevantEvents.has(eventName)) continue;
      const storyId = getStringId(payload[storyDef.correlationKey]);
      if (!storyId) continue;
      const key = makeStoryKey(storyName, storyId);
      const existing = this.active.get(key);
      if (eventName === storyDef.trigger) {
        const now = Date.now();
        const story2 = {
          storyName,
          storyId,
          correlationKey: storyDef.correlationKey,
          startTimeMs: now,
          lastUpdatedMs: now,
          status: "active",
          meta: {
            correlationKey: storyDef.correlationKey,
            storyId,
            storyName,
            trigger: storyDef.trigger
          },
          counters: {},
          timeline: [
            {
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              event: eventName,
              payload
            }
          ]
        };
        this.active.set(key, story2);
        continue;
      }
      if (!existing) {
        if (storyDef.orphanStrategy !== "start") continue;
        const now = Date.now();
        const story2 = {
          storyName,
          storyId,
          correlationKey: storyDef.correlationKey,
          startTimeMs: now,
          lastUpdatedMs: now,
          status: "active",
          meta: {
            correlationKey: storyDef.correlationKey,
            storyId,
            storyName,
            trigger: "orphaned_start"
          },
          counters: {},
          timeline: []
        };
        this.active.set(key, story2);
      }
      const story = this.active.get(key);
      if (!story) continue;
      story.lastUpdatedMs = Date.now();
      if (storyDef.ender && eventName === storyDef.ender) {
        story.timeline.push({
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          event: eventName,
          payload
        });
        this.flushStory(story, "complete");
        this.active.delete(key);
        continue;
      }
      const rule = storyDef.track[eventName];
      if (!rule) continue;
      applyTrackRule(story, eventName, payload, rule);
    }
  }
  flushStory(story, status) {
    const now = Date.now();
    const entry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      storyName: story.storyName,
      storyId: story.storyId,
      status,
      meta: story.meta,
      durationMs: Math.max(0, now - story.startTimeMs),
      counters: story.counters,
      timeline: story.timeline
    };
    this.onFlush(entry);
  }
  cleanupStale() {
    const now = Date.now();
    for (const [key, story] of this.active.entries()) {
      const storyDef = this.cfg.stories[story.storyName];
      if (!storyDef || !storyDef.enabled) {
        this.active.delete(key);
        continue;
      }
      const maxAgeMs = storyDef.maxAgeMs;
      if (now - story.startTimeMs > maxAgeMs) {
        this.flushStory(story, "stale");
        this.active.delete(key);
      }
    }
  }
};

// src/transports/consolePrettyTransport.ts
var ANSI = {
  reset: "\x1B[0m",
  grey: "\x1B[90m",
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  magenta: "\x1B[35m",
  cyan: "\x1B[36m",
  white: "\x1B[37m"
};
function colourise(colour, text) {
  const c = colour ?? "white";
  const code = ANSI[c] ?? ANSI.white;
  return `${code}${text}${ANSI.reset}`;
}
var ConsolePrettyTransport = class {
  pretty;
  constructor(options = {}) {
    this.pretty = options.pretty ?? true;
  }
  log(entry) {
    if (!this.pretty) {
      console.log(JSON.stringify(entry));
      return;
    }
    const level = entry.level.toUpperCase();
    const levelColour = level === "ERROR" ? "red" : level === "WARN" ? "yellow" : level === "INFO" ? "cyan" : "white";
    const ts = colourise("grey", entry.timestamp);
    const lvl = colourise(levelColour, level.padEnd(5));
    const ev = colourise("magenta", entry.event);
    console.log(`${ts} ${lvl} ${ev} ${entry.message}`);
    if (entry.payload && Object.keys(entry.payload).length) {
      console.log(colourise("grey", JSON.stringify(entry.payload, null, 2)));
    }
  }
  story(entry) {
    const header = `GOSSAMER STORY: ${entry.storyName} (${entry.storyId})`;
    const status = entry.status === "complete" ? colourise("green", entry.status) : colourise("yellow", entry.status);
    const line = [
      colourise("grey", entry.timestamp),
      colourise("blue", header),
      status,
      colourise("grey", `${entry.durationMs}ms`)
    ].join(" ");
    console.log(line);
    console.log(colourise("grey", JSON.stringify(entry, null, 2)));
  }
};

// src/gossamer.ts
var Gossamer = class {
  initialised = false;
  config = null;
  transports = [];
  storyEngine = null;
  queue = [];
  async init(userConfig, options = {}) {
    const resolved = resolveConfig(userConfig);
    this.config = resolved;
    this.transports = options.transports?.length ? options.transports : [new ConsolePrettyTransport({ pretty: true })];
    this.storyEngine?.stop();
    this.storyEngine = new StoryEngine(resolved, (storyEntry) => {
      for (const t of this.transports) {
        try {
          t.story(storyEntry);
        } catch {
        }
      }
    });
    this.initialised = true;
    if (this.queue.length) {
      const queued = [...this.queue];
      this.queue = [];
      for (const q of queued) {
        this.emit(q.eventName, q.payload, q.options);
      }
    }
  }
  async initFromFile(options = {}, initOptions = {}) {
    const userConfig = await loadConfigFromFile(options.path);
    await this.init(userConfig, initOptions);
  }
  emit(eventName, payload = {}, options) {
    if (!this.initialised || !this.config) {
      this.queue.push({ eventName, payload, options });
      return;
    }
    const cfg = this.config;
    if (!cfg.enabled) return;
    this.storyEngine?.process(eventName, payload);
    const eventDef = cfg.events[eventName];
    if (!eventDef) {
      if (!cfg.unknownEvents.enabled) return;
      const fallbackLevel = cfg.unknownEvents.level;
      const entry2 = cfg.formatLogEntry({
        eventName,
        payload,
        level: fallbackLevel,
        message: options?.message
      });
      for (const t of this.transports) {
        try {
          t.log(entry2);
        } catch {
        }
      }
      return;
    }
    if (!eventDef.active) return;
    const levelDef = cfg.levels[eventDef.level];
    if (!levelDef || !levelDef.active) return;
    const effectiveVerbosity = options?.verbosityOverride ?? eventDef.verbosity ?? 0;
    if (effectiveVerbosity > cfg.verbosity) {
      return;
    }
    const entry = cfg.formatLogEntry({
      eventName,
      payload,
      level: eventDef.level,
      message: options?.message ?? eventDef.message,
      redact: eventDef.redact
    });
    for (const t of this.transports) {
      try {
        t.log(entry);
      } catch {
      }
    }
  }
  getConfig() {
    return this.config;
  }
  isInitialised() {
    return this.initialised;
  }
};
var gossamer = new Gossamer();

// src/transports/jsonStdoutTransport.ts
var JsonStdoutTransport = class {
  log(entry) {
    console.log(JSON.stringify({ type: "event", ...entry }));
  }
  story(entry) {
    console.log(JSON.stringify({ type: "story", ...entry }));
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ConsolePrettyTransport,
  JsonStdoutTransport,
  gossamer
});
//# sourceMappingURL=index.cjs.map