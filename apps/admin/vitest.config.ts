import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import AlphabeticalSequencer from "./tests/alphabetical-sequencer";
export default defineConfig({ resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }, test: { globalSetup: ["./tests/mongo-setup.ts"], include: ["tests/**/*.test.ts"], fileParallelism: false, sequence: { sequencer: AlphabeticalSequencer }, testTimeout: 20000 } });
