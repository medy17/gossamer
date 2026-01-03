import fs from "node:fs";
import path from "node:path";
import type { GossamerUserConfig } from "./types";

type AnyModule = {
    default?: unknown;
};

function fileExists(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function defaultConfigCandidates(): string[] {
    return [
        "gossamer.config.ts",
        "gossamer.config.js",
        "gossamer.config.cjs",
        "gossamer.config.mjs",
    ];
}

function resolveConfigPath(explicitPath?: string): string {
    if (explicitPath) return path.resolve(process.cwd(), explicitPath);

    for (const candidate of defaultConfigCandidates()) {
        const full = path.resolve(process.cwd(), candidate);
        if (fileExists(full)) return full;
    }

    throw new Error(
        [
            "Gossamer config not found.",
            "Looked for: gossamer.config.ts/js/cjs/mjs in project root.",
            "Either create one, or pass an explicit path to initFromFile({ path }).",
        ].join(" "),
    );
}

export async function loadConfigFromFile(
    explicitPath?: string,
): Promise<GossamerUserConfig> {
    const configPath = resolveConfigPath(explicitPath);

    // jiti loads TS/ESM/CJS without you needing to care.
    const { default: createJiti } = await import("jiti");
    const jiti = createJiti(process.cwd(), {
        interopDefault: true,
        esmResolve: true,
    });

    const mod = jiti(configPath) as AnyModule | GossamerUserConfig;

    const cfg =
        (mod as AnyModule)?.default !== undefined
            ? ((mod as AnyModule).default as GossamerUserConfig)
            : (mod as GossamerUserConfig);

    if (!cfg || typeof cfg !== "object") {
        throw new Error(
            `Invalid Gossamer config at ${configPath}: expected an object export.`,
        );
    }

    return cfg;
}