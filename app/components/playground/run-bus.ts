/**
 * A tiny event bridge between the CaMPL engine's run callbacks and the xterm
 * terminals. The engine emits output per service id; terminals subscribe by id
 * and forward user keystrokes back through `input`.
 */
type Listener = (text: string) => void;

export class RunBus {
  private writers = new Map<string, Set<Listener>>();
  /** Set by the run orchestrator to deliver a completed input line. */
  onInput: (serviceId: string, text: string) => void = () => {};

  subscribe(serviceId: string, fn: Listener): () => void {
    const set = this.writers.get(serviceId) ?? new Set();
    set.add(fn);
    this.writers.set(serviceId, set);
    return () => set.delete(fn);
  }

  /** Program → terminal. */
  emit(serviceId: string, text: string): void {
    this.writers.get(serviceId)?.forEach((fn) => fn(text));
  }

  /** Terminal → program. */
  input(serviceId: string, text: string): void {
    this.onInput(serviceId, text);
  }

  reset(): void {
    this.writers.clear();
    this.onInput = () => {};
  }
}
