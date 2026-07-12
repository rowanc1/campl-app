/**
 * A tiny event bridge between the CaMPL engine's run callbacks and the xterm
 * terminals. The engine emits output per service id; terminals subscribe by id
 * and forward user keystrokes back through `input`.
 *
 * Output emitted before a terminal has subscribed (the real wasm machine can
 * open, write, and close a service faster than xterm mounts) is buffered and
 * replayed to the first subscriber, so nothing is lost.
 */
type Listener = (text: string) => void;

export class RunBus {
  private writers = new Map<string, Set<Listener>>();
  private buffers = new Map<string, string[]>();
  /** Set by the run orchestrator to deliver a completed input line. */
  onInput: (serviceId: string, text: string) => void = () => {};

  subscribe(serviceId: string, fn: Listener): () => void {
    const set = this.writers.get(serviceId) ?? new Set();
    set.add(fn);
    this.writers.set(serviceId, set);

    // Replay anything buffered before this subscriber existed.
    const buffered = this.buffers.get(serviceId);
    if (buffered && buffered.length) {
      this.buffers.delete(serviceId);
      for (const text of buffered) fn(text);
    }

    return () => set.delete(fn);
  }

  /** Program → terminal. */
  emit(serviceId: string, text: string): void {
    const set = this.writers.get(serviceId);
    if (set && set.size) {
      set.forEach((fn) => fn(text));
    } else {
      const buf = this.buffers.get(serviceId) ?? [];
      buf.push(text);
      this.buffers.set(serviceId, buf);
    }
  }

  /** Terminal → program. */
  input(serviceId: string, text: string): void {
    this.onInput(serviceId, text);
  }

  reset(): void {
    this.writers.clear();
    this.buffers.clear();
    this.onInput = () => {};
  }
}
