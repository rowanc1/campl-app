import {
  type CamplEngine,
  type CompileOptions,
  type CompileResult,
  type Diagnostic,
  type RunCallbacks,
  type RunHandle,
} from "./engine";
import { MockEngine } from "./mock-engine";

interface WorkerResult {
  type: "result";
  id: number;
  json: string;
}
interface WorkerError {
  type: "error";
  id: number;
  message: string;
}
interface WorkerReady {
  type: "ready" | "fatal";
  message?: string;
}
type WorkerMsg = WorkerResult | WorkerError | WorkerReady;

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

/** Pull "line N and column M" out of the pretty-printed error text, if present. */
function parseDiagnostic(d: RawDiag): Diagnostic {
  const m = /at line (\d+) and column (\d+)/.exec(d.message);
  return {
    severity: d.severity,
    stage: d.stage as Diagnostic["stage"],
    message: d.message.replace(/^[\s•]+/, "").trim(),
    line: m ? Number(m[1]) : undefined,
    column: m ? Number(m[2]) : undefined,
  };
}

/**
 * Engine backed by the real MPL frontend compiled to WebAssembly.
 *
 * `compile()` runs parse → rename → typecheck → pattern-compile → lambda-lift in
 * the wasm module (via a Web Worker) and returns genuine stage dumps and
 * diagnostics. `run()` still delegates to the mock runtime — executing programs
 * needs the abstract machine (MPLMACH), which is the next milestone (M2).
 */
export class WasmEngine implements CamplEngine {
  readonly name = "WebAssembly";
  readonly ready: Promise<void>;

  private worker: Worker;
  private seq = 0;
  private pending = new Map<
    number,
    { resolve: (json: string) => void; reject: (err: Error) => void }
  >();
  private mock = new MockEngine();

  constructor() {
    this.worker = new Worker(new URL("./wasm/mpl.worker.ts", import.meta.url), {
      type: "module",
    });

    this.ready = new Promise<void>((resolve, reject) => {
      const onReady = (ev: MessageEvent<WorkerMsg>) => {
        if (ev.data.type === "ready") {
          this.worker.removeEventListener("message", onReady);
          resolve();
        } else if (ev.data.type === "fatal") {
          this.worker.removeEventListener("message", onReady);
          reject(new Error(ev.data.message ?? "wasm failed to load"));
        }
      };
      this.worker.addEventListener("message", onReady);
    });

    this.worker.addEventListener("message", (ev: MessageEvent<WorkerMsg>) => {
      const msg = ev.data;
      if (msg.type === "result") {
        this.pending.get(msg.id)?.resolve(msg.json);
        this.pending.delete(msg.id);
      } else if (msg.type === "error") {
        this.pending.get(msg.id)?.reject(new Error(msg.message));
        this.pending.delete(msg.id);
      }
    });
  }

  private request(source: string): Promise<string> {
    const id = ++this.seq;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: "compile", id, source });
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

  run(source: string, cb: RunCallbacks): Promise<RunHandle> {
    // M1: execution still uses the scripted mock runtime.
    return this.mock.run(source, cb);
  }
}
