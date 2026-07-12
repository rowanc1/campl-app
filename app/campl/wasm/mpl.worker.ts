/// <reference lib="webworker" />
/**
 * Web Worker hosting the real CaMPL frontend compiled to WebAssembly.
 *
 * The wasm module (`mpl-wasm.wasm`) is the GHC-wasm build of the MPL package;
 * it exports `camplCompile :: JSString -> IO JSString` via GHC's JavaScript FFI.
 * We run it here (off the main thread) behind a browser WASI shim.
 */
import {
  WASI,
  OpenFile,
  ConsoleStdout,
  File as WasiFile,
} from "@bjorn3/browser_wasi_shim";
// The JSFFI glue emitted by GHC's post-linker (see wasm/out).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- generated JS module without types
import ghcffi from "./ghc_wasm_jsffi.js";

type CompileMsg = { type: "compile"; id: number; source: string };

interface WasmExports {
  memory: WebAssembly.Memory;
  _initialize?: () => void;
  hs_init: (argc: number, argv: number) => void;
  camplCompile: (source: string) => Promise<string> | string;
  [k: string]: unknown;
}

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

self.onmessage = async (ev: MessageEvent<CompileMsg>) => {
  const msg = ev.data;
  if (msg.type !== "compile") return;
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
};

// Kick off instantiation eagerly so the first compile is fast.
ensureReady().then(
  () => self.postMessage({ type: "ready" }),
  (err) =>
    self.postMessage({
      type: "fatal",
      message: err instanceof Error ? err.message : String(err),
    })
);
