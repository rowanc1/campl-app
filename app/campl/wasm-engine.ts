import {
  type CamplEngine,
  type CompileOptions,
  type CompileResult,
  type Diagnostic,
  type RunCallbacks,
  type RunHandle,
  type ServiceHandle,
} from "./engine";

interface RawStage {
  stage: string;
  label: string;
  output: string;
}
interface RawDiag {
  severity: Diagnostic["severity"];
  stage: string;
  message: string;
}
interface RawResult {
  ok: boolean;
  stages: RawStage[];
  diagnostics: RawDiag[];
}

interface ActiveRun {
  id: number;
  cb: RunCallbacks;
  serviceCount: number;
  finished: boolean;
}

function parseDiagnostic(d: RawDiag): Diagnostic {
  const m = /at line (\d+) and column (\d+)/.exec(d.message);
  // The location is captured in line/column below, so drop it from the prose
  // (and the leading pretty-printer bullet) to keep the hover tidy.
  const message = d.message
    .replace(/\s*at line \d+ and column \d+/g, "")
    .replace(/^[\s•]+/, "")
    .trim();
  return {
    severity: d.severity,
    stage: d.stage as Diagnostic["stage"],
    message,
    line: m ? Number(m[1]) : undefined,
    column: m ? Number(m[2]) : undefined,
  };
}

/**
 * Engine backed by the real CaMPL toolchain compiled to WebAssembly:
 *   - compile() runs the MPL frontend (genuine stage dumps + diagnostics)
 *   - run() assembles and executes the program on the abstract machine, with
 *     each terminal service the program opens streamed to an xterm pane.
 */
export class WasmEngine implements CamplEngine {
  readonly name = "WebAssembly";
  readonly ready: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (e: Error) => void;

  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<
    number,
    { resolve: (json: string) => void; reject: (err: Error) => void }
  >();
  private activeRun: ActiveRun | null = null;

  constructor() {
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.getWorker();
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL("./wasm/mpl.worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker.addEventListener("message", (ev) => this.handle(ev.data));
    }
    return this.worker;
  }

  private handle(msg: any) {
    switch (msg?.type) {
      case "ready":
        this.resolveReady();
        break;
      case "fatal":
        this.rejectReady(new Error(msg.message ?? "wasm failed to load"));
        break;
      case "result":
        this.pending.get(msg.id)?.resolve(msg.json);
        this.pending.delete(msg.id);
        break;
      case "error":
        this.pending.get(msg.id)?.reject(new Error(msg.message));
        this.pending.delete(msg.id);
        break;
      case "svOpen": {
        const run = this.activeRun;
        if (!run) break;
        run.serviceCount += 1;
        const service: ServiceHandle = {
          id: String(msg.id),
          kind: "stringTerminal",
          title: run.serviceCount === 1 ? "Console" : `Terminal ${run.serviceCount}`,
        };
        run.cb.onServiceOpen(service);
        break;
      }
      case "svPut":
        this.activeRun?.cb.onOutput(String(msg.id), msg.text);
        break;
      case "svClose":
        this.activeRun?.cb.onServiceClose(String(msg.id));
        break;
      case "svGetWaiting":
        // The machine is blocked on input for this service; the terminal is
        // already accepting keystrokes, so nothing to do here.
        break;
      case "runDone": {
        const run = this.activeRun;
        if (!run || run.finished) break;
        run.finished = true;
        let ok = true;
        let error = "";
        try {
          const parsed = JSON.parse(msg.json);
          ok = parsed.ok;
          error = parsed.error ?? "";
        } catch {
          /* ignore */
        }
        if (!ok && error) run.cb.onError(error);
        run.cb.onExit(ok ? 0 : 1);
        this.activeRun = null;
        break;
      }
    }
  }

  private request(source: string): Promise<string> {
    const worker = this.getWorker();
    const id = ++this.seq;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ type: "compile", id, source });
    });
  }

  async compile(source: string, _opts?: CompileOptions): Promise<CompileResult> {
    const start = performance.now();
    const json = await this.request(source);
    const raw = JSON.parse(json) as RawResult;
    return {
      ok: raw.ok,
      stages: raw.stages.map((s) => ({
        stage: s.stage as CompileResult["stages"][number]["stage"],
        label: s.label,
        output: s.output,
      })),
      diagnostics: raw.diagnostics.map(parseDiagnostic),
      durationMs: Math.round(performance.now() - start),
    };
  }

  async run(source: string, cb: RunCallbacks): Promise<RunHandle> {
    await this.ready;
    const worker = this.getWorker();
    const id = ++this.seq;
    this.activeRun = { id, cb, serviceCount: 0, finished: false };
    worker.postMessage({ type: "run", id, source });

    return {
      sendInput: (serviceId, text) =>
        worker.postMessage({ type: "input", id: Number(serviceId), text }),
      stop: () => this.stop(),
    };
  }

  /**
   * Stop a run by terminating the worker (the only reliable way to interrupt a
   * running machine — e.g. an infinite loop). The next compile/run lazily spins
   * up a fresh instance.
   */
  private stop() {
    const run = this.activeRun;
    if (run && !run.finished) {
      run.finished = true;
      run.cb.onError("Run stopped.");
      run.cb.onExit(130);
    }
    this.activeRun = null;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    // Reject any in-flight compiles; they'll be retried against a new worker.
    for (const { reject } of this.pending.values()) {
      reject(new Error("worker restarted"));
    }
    this.pending.clear();
  }
}
