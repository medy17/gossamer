import { gossamer } from "../src/gossamer";
import { FileTransport } from "../src/transports/fileTransport";
import fs from "node:fs";
import path from "node:path";

async function run() {
    const logPath = path.join(process.cwd(), "crash-test.log");

    // Clear previous log
    if (fs.existsSync(logPath)) fs.unlinkSync(logPath);

    console.log("Initializing Gossamer...");
    await gossamer.init({
        enabled: true,
        events: {
            "test:event": { level: "INFO" },
            "crash:event": { level: "ERROR" },
        },
    }, {
        transports: [
            new FileTransport({ path: logPath }),
        ],
        captureCrashes: true,
    });

    console.log("Emitting normal event...");
    gossamer.emit("test:event", { message: "I am safe" });

    // Wait a brief moment to ensure init completes
    await new Promise(r => setTimeout(r, 100));

    console.log("Crashing process in 3... 2... 1...");

    // Deliberate crash
    setTimeout(() => {
        throw new Error("Deliberate Crash for Testing!");
    }, 100);
}

run();
