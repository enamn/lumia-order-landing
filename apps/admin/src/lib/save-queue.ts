// Serializes writes while coalescing unsent edits. Failed edits remain available for retry.
export class SaveQueue<T> {
  private pending: T | undefined;
  private running = false;
  private paused = false;
  constructor(private write: (value: T) => Promise<void>, private changed: (state: "saving" | "saved" | "error", error?: unknown) => void) {}
  enqueue(value: T) { this.pending = value; if (!this.paused) void this.drain(); }
  retry() { this.paused = false; void this.drain(); }
  private async drain() {
    if (this.running || this.paused || this.pending === undefined) return;
    this.running = true; this.changed("saving");
    while (this.pending !== undefined && !this.paused) {
      const value: T = this.pending; this.pending = undefined;
      try { await this.write(value); }
      catch (error) { if (this.pending === undefined) this.pending = value; this.paused = true; this.changed("error", error); }
    }
    this.running = false;
    if (!this.paused) this.changed("saved");
  }
}
