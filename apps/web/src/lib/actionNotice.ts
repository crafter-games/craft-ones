/** One transient notice. Repeating a rejection never extends its lifetime. */
export class ActionNotice {
  private message = "";
  private timer: ReturnType<typeof setTimeout> | undefined;
  private revision = 0;

  constructor(private publish: (message: string) => void) {}

  report(message: string | null) {
    if (!message) {
      this.clear();
      return;
    }
    if (message === this.message) return;
    this.dispose();
    this.message = message;
    this.publish(message);
    const revision = this.revision;
    this.timer = setTimeout(() => {
      if (revision !== this.revision) return;
      this.timer = undefined;
      // Suppress the same rejected action until success or the next turn.
      this.publish("");
    }, 3000);
  }

  clear() {
    this.dispose();
    this.publish("");
  }

  dispose() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.message = "";
    this.revision++;
  }
}
