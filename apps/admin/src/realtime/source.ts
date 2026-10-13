import { db } from "@/server/db";

// Where the realtime service learns that a new event exists. The events themselves are always rows in `device_events` (the durable log: replay after an
// outage reads it), so a source only has to say "these rows are new". The socket server does not care how it finds out, which is what lets us scale
// without rebuilding it:
//   polling (today)       one indexed query every pollMs per instance, no query while nobody is connected. Good to a few thousand terminals.
//   change stream (next)  MongoDB pushes inserts (needs the replica set we already run): no polling delay, no idle query. Add a source, change one line in main.ts.
//   Redis pub/sub (later) publish() also notifies Redis, instances subscribe only to the channels they hold. For tens of thousands, many instances.
export interface EventRow { id: string; channel: string; type: string; payload: unknown; createdAt: Date }
export interface EventSource {
  // Starts delivering new rows to onRows. `listening` tells the source whether anyone is connected (a polling source skips its query when not).
  start(onRows: (rows: EventRow[]) => void, listening: () => boolean): void;
  stop(): void;
}

// An event gets its timestamp when it is written but only becomes visible when its write commits, so a slower write can appear after a newer one.
// Reading from slightly before the cursor (and skipping what was already delivered) means such a late event is still picked up.
const LOOKBACK_MS = 2000;

export function pollingSource(pollMs = 500): EventSource {
  let timer: ReturnType<typeof setInterval> | null = null, cursor = new Date(), seen = new Set<string>(), running = false, stopped = false;
  return {
    start(onRows, listening) {
      timer = setInterval(async () => {
        if (running || stopped) return;
        if (!listening()) { cursor = new Date(); return; } // nobody to tell; what is missed meanwhile is replayed when a client connects
        running = true;
        try {
          // Events written together share one timestamp, so a page can end in the middle of such a group and the next poll (from that same time) would start at the
          // same place. When a page comes back full, read a bigger one until it is not: then everything from the cursor on has been seen.
          let take = 500, rows = await db.deviceEvent.findMany({ where: { createdAt: { gte: new Date(cursor.getTime() - LOOKBACK_MS) } }, orderBy: { createdAt: "asc" }, take });
          while (rows.length === take && take < 32_000) { take *= 4; rows = await db.deviceEvent.findMany({ where: { createdAt: { gte: new Date(cursor.getTime() - LOOKBACK_MS) } }, orderBy: { createdAt: "asc" }, take }); }
          const fresh: EventRow[] = [];
          for (const e of rows) { if (seen.has(e.id)) continue; seen.add(e.id); if (e.createdAt > cursor) cursor = e.createdAt; fresh.push(e); }
          if (seen.size > 50_000) seen = new Set(rows.map(r => r.id));
          if (fresh.length) onRows(fresh);
        } catch (err) { console.error(JSON.stringify({ level: "error", code: "REALTIME_POLL_FAILED", message: err instanceof Error ? err.message : String(err) })); }
        running = false;
      }, pollMs);
    },
    stop() { stopped = true; if (timer) clearInterval(timer); },
  };
}
