function isObjectLike(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function redactKeys(
    payload: Record<string, unknown>,
    redact: string[] = [],
): Record<string, unknown> {
    if (!redact.length) return payload;

    const out: Record<string, unknown> = { ...payload };

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

export function pickKeys(
    payload: Record<string, unknown>,
    keys: string[] = [],
): Record<string, unknown> {
    if (!keys.length) return payload;

    const out: Record<string, unknown> = {};
    for (const k of keys) {
        if (k in payload) out[k] = payload[k];
    }
    return out;
}