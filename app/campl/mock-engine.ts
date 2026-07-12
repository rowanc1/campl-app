import {
  COMPILE_STAGES,
  type CamplEngine,
  type CompileOptions,
  type CompileResult,
  type Diagnostic,
  type RunCallbacks,
  type RunHandle,
  type ServiceHandle,
  type StageDump,
} from "./engine";
import { EXAMPLES } from "./examples";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Top-level declaration kinds we can cheaply recognise in source. */
const DECL_RE =
  /^\s*(protocol|coprotocol|data|codata|fun|proc|defn)\s+([A-Za-z_][\w']*)/gm;

interface Decl {
  kind: string;
  name: string;
}

function scanDecls(source: string): Decl[] {
  const decls: Decl[] = [];
  for (const m of source.matchAll(DECL_RE)) {
    decls.push({ kind: m[1], name: m[2] });
  }
  return decls;
}

/**
 * Produce an illustrative dump for each pipeline stage. These are *mock*
 * renderings derived from the source — the real engine emits GHC pretty-printed
 * ASTs. They are labelled as mock output so nothing here is misrepresented.
 */
function mockStages(source: string, decls: Decl[]): StageDump[] {
  const names = decls.map((d) => `${d.kind} ${d.name}`);
  const procs = decls.filter((d) => d.kind === "proc").map((d) => d.name);
  const protos = decls.filter((d) => /protocol$/.test(d.kind)).map((d) => d.name);

  const render = (stage: (typeof COMPILE_STAGES)[number]): string => {
    const header = `-- mock ${stage.id} output --\n-- ${stage.blurb}\n`;
    switch (stage.id) {
      case "parsed":
        return (
          header +
          `module Main\n` +
          decls.map((d, i) => `  [${i}] ${d.kind} :: ${d.name}`).join("\n")
        );
      case "renamed":
        return (
          header +
          decls
            .map((d, i) => `  ${d.kind} ${d.name}%${100 + i}`)
            .join("\n")
        );
      case "type-checked":
        return (
          header +
          protos.map((p) => `  protocol ${p} :: ok`).join("\n") +
          (protos.length ? "\n" : "") +
          procs.map((p) => `  proc ${p} :: | ... => ... ⊢ well-typed`).join("\n")
        );
      case "pattern-compiled":
        return (
          header +
          procs
            .map((p) => `  ${p}: case-tree { <patterns lowered> }`)
            .join("\n")
        );
      case "lambda-lifted":
        return (
          header +
          names.map((n, i) => `  $lifted_${i} = <${n}>`).join("\n")
        );
      case "assembled":
        return (
          header +
          procs
            .map(
              (p) =>
                `  ${p}:\n    cLoad 0\n    cRun ${p}_body\n    cHPut\n    cHalt`
            )
            .join("\n")
        );
    }
  };

  return COMPILE_STAGES.map((s) => ({
    stage: s.id,
    label: s.label,
    output: render(s),
  }));
}

function mockDiagnostics(source: string, decls: Decl[]): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const hasRun = decls.some((d) => d.kind === "proc" && d.name === "run");
  if (!hasRun && decls.some((d) => d.kind === "proc")) {
    diags.push({
      severity: "warning",
      stage: "renamed",
      message:
        "No `proc run` entry point found — the machine starts from `run`.",
    });
  }
  if (source.trim().length === 0) {
    diags.push({
      severity: "error",
      stage: "parsed",
      message: "Empty program.",
      line: 1,
      column: 1,
    });
  }
  return diags;
}

/** Controller for one mock run — bridges async behaviours and user input. */
class MockRun implements RunHandle {
  private stopped = false;
  private waiters = new Map<string, ((v: string) => void)[]>();
  private queues = new Map<string, string[]>();

  constructor(private cb: RunCallbacks) {}

  /** Wait for the next line of input on a service. */
  input(serviceId: string): Promise<string> {
    const q = this.queues.get(serviceId);
    if (q && q.length) return Promise.resolve(q.shift()!);
    return new Promise((resolve) => {
      const arr = this.waiters.get(serviceId) ?? [];
      arr.push(resolve);
      this.waiters.set(serviceId, arr);
    });
  }

  sendInput(serviceId: string, text: string): void {
    if (this.stopped) return;
    const arr = this.waiters.get(serviceId);
    if (arr && arr.length) {
      arr.shift()!(text);
      return;
    }
    const q = this.queues.get(serviceId) ?? [];
    q.push(text);
    this.queues.set(serviceId, q);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.cb.onError("Run stopped by user.");
    this.cb.onExit(130);
  }

  get isStopped() {
    return this.stopped;
  }

  open(kind: ServiceHandle["kind"], title: string): ServiceHandle {
    const service: ServiceHandle = {
      id: `svc_${title.toLowerCase().replace(/\s+/g, "_")}`,
      kind,
      title,
    };
    this.cb.onServiceOpen(service);
    return service;
  }

  out(id: string, text: string) {
    if (!this.stopped) this.cb.onOutput(id, text);
  }

  close(id: string) {
    if (!this.stopped) this.cb.onServiceClose(id);
  }

  exit(code = 0) {
    if (!this.stopped) this.cb.onExit(code);
  }
}

/** Per-example scripted behaviours. Falls back to a generic run when unknown. */
type Behavior = (run: MockRun) => Promise<void>;

const BEHAVIORS: Record<string, Behavior> = {
  async helloworld(run) {
    const c = run.open("console", "Console");
    await delay(250);
    run.out(c.id, "Hello World\n");
    await delay(150);
    run.close(c.id);
    run.exit(0);
  },

  async "helloworld-terminal"(run) {
    const t = run.open("stringTerminal", "Terminal");
    await delay(250);
    run.out(t.id, "Hello World! press any key to exit...\n");
    await run.input(t.id);
    if (run.isStopped) return;
    run.close(t.id);
    run.exit(0);
  },

  async "echo-until-quit"(run) {
    const c = run.open("console", "Console");
    await delay(200);
    while (!run.isStopped) {
      run.out(c.id, "Enter something... (Enter q to exit)\n");
      const line = await run.input(c.id);
      if (run.isStopped) return;
      if (line.trim().startsWith("q")) {
        run.out(c.id, "Bye...\n");
        run.close(c.id);
        run.exit(0);
        return;
      }
      run.out(c.id, "you entered\n");
      run.out(c.id, `${line}\n`);
    }
  },

  async "split-console"(run) {
    const t = run.open("stringTerminal", "Terminal");
    await delay(250);
    run.out(t.id, "(terminal ready — type a line to echo)\n");
    const line = await run.input(t.id);
    if (run.isStopped) return;
    run.out(t.id, `${line}\n`);
    await delay(120);
    run.close(t.id);
    run.exit(0);
  },
};

async function genericBehavior(run: MockRun): Promise<void> {
  const c = run.open("console", "Console");
  await delay(250);
  run.out(
    c.id,
    "[mock engine] Compiled successfully. This program isn't one of the\n" +
      "bundled examples, so the mock runtime can't execute it — swap in the\n" +
      "WebAssembly engine to run arbitrary CaMPL. See docs/WASM_PLAN.md.\n"
  );
  await delay(150);
  run.close(c.id);
  run.exit(0);
}

function matchExampleId(source: string): string | undefined {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const n = norm(source);
  return EXAMPLES.find((e) => norm(e.source) === n)?.id;
}

export class MockEngine implements CamplEngine {
  readonly name = "Mock";
  readonly ready = Promise.resolve();

  async compile(source: string, _opts?: CompileOptions): Promise<CompileResult> {
    const start = performance.now();
    await delay(120);
    const decls = scanDecls(source);
    const diagnostics = mockDiagnostics(source, decls);
    const ok = !diagnostics.some((d) => d.severity === "error");
    return {
      ok,
      diagnostics,
      stages: ok ? mockStages(source, decls) : [],
      durationMs: Math.round(performance.now() - start),
    };
  }

  async run(source: string, cb: RunCallbacks): Promise<RunHandle> {
    const run = new MockRun(cb);
    const id = matchExampleId(source);
    const behavior = (id && BEHAVIORS[id]) || genericBehavior;
    // Kick off asynchronously so callers get the handle immediately.
    behavior(run).catch((err) =>
      cb.onError(err instanceof Error ? err.message : String(err))
    );
    return run;
  }
}
