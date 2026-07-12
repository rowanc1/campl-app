/**
 * CamplEngine — the abstraction between the UI and the CaMPL compiler/runtime.
 *
 * The real CaMPL toolchain is a Haskell monorepo (see docs/PLAN.md):
 *   MPL (frontend)  ->  MPLASM (assembler)  ->  MPLMACH (abstract machine)
 *
 * This interface mirrors that pipeline so a mock backend today and a
 * WebAssembly backend tomorrow are drop-in interchangeable. See:
 *   - mock-engine.ts   scripted outputs for the bundled examples (works now)
 *   - docs/WASM_PLAN.md how the GHC-wasm build will implement the same API
 */

/** Compiler pipeline stages exposed by `mpl --dump-<stage>`. */
export type CompileStage =
  | "parsed"
  | "renamed"
  | "type-checked"
  | "pattern-compiled"
  | "lambda-lifted"
  | "assembled";

export const COMPILE_STAGES: { id: CompileStage; label: string; blurb: string }[] = [
  { id: "parsed", label: "Parsed", blurb: "Concrete syntax → abstract syntax tree (BNFC)." },
  { id: "renamed", label: "Renamed", blurb: "Every binder gets a globally unique name." },
  { id: "type-checked", label: "Type-checked", blurb: "Sequential data types and concurrent protocols verified." },
  { id: "pattern-compiled", label: "Pattern-compiled", blurb: "Pattern matches lowered to case trees." },
  { id: "lambda-lifted", label: "Lambda-lifted", blurb: "Closures floated to top level for the machine." },
  { id: "assembled", label: "Assembled", blurb: "AMPL machine instructions for MPLMACH." },
];

export type Severity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: Severity;
  stage: CompileStage;
  message: string;
  /** 1-based source position, when known. */
  line?: number;
  column?: number;
}

export interface StageDump {
  stage: CompileStage;
  label: string;
  /** Pretty-printed output of the stage. */
  output: string;
}

export interface CompileResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  stages: StageDump[];
  durationMs: number;
}

/**
 * A "service" is a channel endpoint the running program talks to. In the CLI
 * these are external Alacritty terminals connected over a socket; in the
 * browser each service is rendered as an xterm.js pane.
 */
export type ServiceKind = "console" | "stringTerminal";

export interface ServiceHandle {
  id: string;
  kind: ServiceKind;
  /** Human label for the terminal tab, e.g. "Console" or "Terminal 1". */
  title: string;
}

export interface RunCallbacks {
  /** A new terminal/service was opened by the program. */
  onServiceOpen(service: ServiceHandle): void;
  /** The machine `put` some text onto a service (program → user). */
  onOutput(serviceId: string, text: string): void;
  /** The service was closed by the program. */
  onServiceClose(serviceId: string): void;
  /** The machine halted. */
  onExit(code: number): void;
  /** A runtime error was raised. */
  onError(message: string): void;
}

export interface RunHandle {
  /** Deliver a line of user input to a service the machine is `get`-ing on. */
  sendInput(serviceId: string, text: string): void;
  /** Terminate the running machine. */
  stop(): void;
}

export interface CompileOptions {
  /** Limit which stage dumps to compute (defaults to all). */
  stages?: CompileStage[];
}

export interface CamplEngine {
  /** Display name of the backend, e.g. "Mock" or "WebAssembly". */
  readonly name: string;
  /** Resolves once the backend is loaded and ready. */
  readonly ready: Promise<void>;
  /** Run the frontend + assembler, returning diagnostics and stage dumps. */
  compile(source: string, opts?: CompileOptions): Promise<CompileResult>;
  /** Compile then run on the abstract machine, streaming service I/O. */
  run(source: string, cb: RunCallbacks): Promise<RunHandle>;
}
