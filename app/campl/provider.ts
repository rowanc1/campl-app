import type { CamplEngine } from "./engine";
import { MockEngine } from "./mock-engine";

let engine: CamplEngine | null = null;

/**
 * Returns the active CaMPL engine (singleton).
 *
 * Today this is the {@link MockEngine}. When the WebAssembly build lands
 * (docs/WASM_PLAN.md), swap the constructor here — or branch on an env flag —
 * and the entire UI runs against the real compiler with no other changes.
 */
export function getEngine(): CamplEngine {
  if (!engine) {
    engine = new MockEngine();
    // engine = import.meta.env.VITE_CAMPL_ENGINE === "wasm"
    //   ? new WasmEngine()
    //   : new MockEngine();
  }
  return engine;
}
