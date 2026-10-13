import { startRealtime } from "./server";
// Start with: npm run realtime  (PORT, DATABASE_URL and BETTER_AUTH_SECRET must be the same as the web app's; optional MAX_CONNECTIONS, REALTIME_POLL_MS).
startRealtime({ port: Number(process.env.PORT ?? 3001) }).then(r => {
  console.log(JSON.stringify({ level: "info", code: "REALTIME_READY", port: r.port }));
  // Cloud Run sends SIGTERM before stopping an instance: say goodbye to every client (they reconnect elsewhere and replay) instead of cutting them off.
  const stop = () => { void r.close().finally(() => process.exit(0)); };
  process.once("SIGTERM", stop); process.once("SIGINT", stop);
});
