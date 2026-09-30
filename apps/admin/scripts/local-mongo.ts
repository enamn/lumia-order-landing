import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
async function main() {
const dbPath = resolve(".local/mongo");
await mkdir(dbPath, { recursive: true });
const server = await MongoMemoryReplSet.create({ binary: { version: "8.0.18" }, replSet: { name: "rs0", count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" }, instanceOpts: [{ port: 27017, dbPath }] });
console.log("Development MongoDB ready on 127.0.0.1:27017. Data is kept in apps/admin/.local/mongo.");
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await server.stop({ doCleanup: false }); process.exit(); }
process.on("SIGINT", stop); process.on("SIGTERM", stop);

}
main().catch(() => { console.error("Could not start local MongoDB. Check port 27017 and MongoDB binary availability."); process.exitCode = 1; });
