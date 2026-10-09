import { startRealtime } from "./server";
// Start with: npm run realtime  (PORT, DATABASE_URL and BETTER_AUTH_SECRET must be the same as the web app's).
startRealtime({ port: Number(process.env.PORT ?? 3001) }).then(r => console.log(JSON.stringify({ level: "info", code: "REALTIME_READY", port: r.port })));
