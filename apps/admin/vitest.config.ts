import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import AlphabeticalSequencer from "./tests/alphabetical-sequencer";
export default defineConfig({ resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }, test: { globalSetup: ["./tests/mongo-setup.ts"], setupFiles: ["./tests/open-hours.setup.ts"], include: ["tests/**/*.test.ts"], fileParallelism: false, sequence: { sequencer: AlphabeticalSequencer }, testTimeout: 20000, env: { TRIAL_DAYS: "" } /* the tests always run with the real 14-day trial, whatever the local .env says */ } });
