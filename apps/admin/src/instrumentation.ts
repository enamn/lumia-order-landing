// Runs once when the server starts. Makes sure the database has the unique indexes the app relies on (one reminder per period, one invoice per renewal, one usage counter per period, ...).
// It is safe to repeat and never blocks or stops the server: a missing index was once the reason reminders were sent every hour.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV === "test") return;
  void import("../scripts/mongo-indexes").then(m => m.ensureMongoIndexes()).catch(e => console.error(JSON.stringify({ level: "error", code: "INDEX_SETUP_FAILED", message: e instanceof Error ? e.message : String(e) })));
}
