/// <reference lib="webworker" />
/**
 * Web Worker hosting the real CaMPL compiler AND abstract machine, compiled to
 * WebAssembly (GHC wasm backend).
 *
 * Exports used:
 *   camplCompile :: JSString -> IO JSString   (parse → typecheck → lambda-lift dumps)
 *   camplRun     :: JSString -> IO JSString   (assemble → run on the machine)
 *
 * While a program runs, the machine's terminal services call back into JS
 * through the `__camplSv*` bridge below; we forward those to the main thread as
 * svOpen/svPut/svClose, and deliver user input by resolving svGet promises.
 */
import {
  WASI,
  OpenFile,
  ConsoleStdout,
  File as WasiFile,
} from "@bjorn3/browser_wasi_shim";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- generated JS module without types
import ghcffi from "./ghc_wasm_jsffi.js";

interface WasmExports {
  memory: WebAssembly.Memory;
  _initialize?: () => void;
  hs_init: (argc: number, argv: number) => void;
  camplCompile: (source: string) => Promise<string> | string;
  camplRun: (source: string) => Promise<string> | string;
  [k: string]: unknown;
}

// --- service bridge state ---
// Pending svGet resolvers, keyed by service id (the machine blocks until we
// resolve). One run at a time, so a flat map is fine.
const pendingGets = new Map<number, (line: string) => void>();

const g = globalThis as unknown as Record<string, unknown>;

g.__camplSvOpen = (id: number, kind: number) =>
  self.postMessage({ type: "svOpen", id, kind });
g.__camplSvPut = (id: number, text: string) =>
  self.postMessage({ type: "svPut", id, text });
g.__camplSvClose = (id: number) => {
  pendingGets.delete(id);
  self.postMessage({ type: "svClose", id });
};
g.__camplSvGet = (id: number): Promise<string> =>
  new Promise<string>((resolve) => {
    pendingGets.set(id, resolve);
    self.postMessage({ type: "svGetWaiting", id });
  });

let exportsReady: Promise<WasmExports> | null = null;

function wasmUrl(): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return `${base}/wasm/mpl-wasm.wasm`;
}

async function init(): Promise<WasmExports> {
  const wasi = new WASI(
    ["mpl-wasm"],
    [],
    [
      new OpenFile(new WasiFile([])),
      ConsoleStdout.lineBuffered((m) => console.log("[wasm]", m)),
      ConsoleStdout.lineBuffered((m) => console.warn("[wasm]", m)),
    ]
  );

  const mod = await WebAssembly.compileStreaming(fetch(wasmUrl()));
  const __exports: Partial<WasmExports> = {};
  const jsffi = ghcffi(__exports);
  const instance = await WebAssembly.instantiate(mod, {
    wasi_snapshot_preview1: wasi.wasiImport,
    ghc_wasm_jsffi: jsffi,
  });
  Object.assign(__exports, instance.exports);

  wasi.initialize(
    instance as unknown as {
      exports: { memory: WebAssembly.Memory; _initialize?: () => unknown };
    }
  );
  const exps = instance.exports as unknown as WasmExports;
  exps.hs_init(0, 0);
  return exps;
}

function ensureReady(): Promise<WasmExports> {
  if (!exportsReady) exportsReady = init();
  return exportsReady;
}

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data;

  if (msg.type === "input") {
    const resolve = pendingGets.get(msg.id);
    if (resolve) {
      pendingGets.delete(msg.id);
      resolve(msg.text);
    }
    return;
  }

  if (msg.type === "compile") {
    try {
      const exps = await ensureReady();
      const json = await exps.camplCompile(msg.source);
      self.postMessage({ type: "result", id: msg.id, json });
    } catch (err) {
      self.postMessage({
        type: "error",
        id: msg.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (msg.type === "run") {
    try {
      const exps = await ensureReady();
      const json = await exps.camplRun(msg.source);
      self.postMessage({ type: "runDone", id: msg.id, json });
    } catch (err) {
      self.postMessage({
        type: "runDone",
        id: msg.id,
        json: JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      });
    } finally {
      pendingGets.clear();
    }
    return;
  }
};

ensureReady().then(
  () => self.postMessage({ type: "ready" }),
  (err) =>
    self.postMessage({
      type: "fatal",
      message: err instanceof Error ? err.message : String(err),
    })
);
