import { MongoMemoryReplSet } from "mongodb-memory-server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
export default async function setup() {
 if (process.env.RUN_DB_TESTS !== "true") return;
 const server = await MongoMemoryReplSet.create({ binary: { version: "8.0.18" }, replSet: { name: "test-rs", count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" } });
 process.env.DATABASE_URL = server.getUri("lumia_order_test");
 process.env.BETTER_AUTH_SECRET = "test-only-secret-not-for-deployment-0123456789";
 process.env.BETTER_AUTH_URL = "http://localhost:3000";
 process.env.APP_URL = "http://localhost:3000";
 await promisify(execFile)(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env: process.env });
 return async () => { await server.stop(); };
}
