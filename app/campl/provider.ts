import type { CamplEngine } from "./engine";
import { MockEngine } from "./mock-engine";
import { WasmEngine } from "./wasm-engine";

let engine: CamplEngine | null = null;

/**
 * Returns the active CaMPL engine (singleton).
 *
 * In the browser this is the {@link WasmEngine} — the real MPL frontend compiled
 * to WebAssembly (parse → typecheck → lambda-lift), with genuine diagnostics.
 * Program execution still falls back to the scripted mock runtime until the
 * abstract machine is ported (M2). On the server (SSR) we use the mock so
 * nothing touches Worker/WebAssembly during rendering.
 */
export function getEngine(): CamplEngine {
  if (!engine) {
    const canUseWasm =
      typeof window !== "undefined" && typeof Worker !== "undefined";
    engine = canUseWasm ? new WasmEngine() : new MockEngine();
  }
  return engine;
}
