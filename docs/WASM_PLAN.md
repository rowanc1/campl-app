# Porting the CaMPL toolchain to WebAssembly

Goal: run the real `mpl` compiler **and** abstract machine entirely in the
browser, behind the existing [`CamplEngine`](../app/campl/engine.ts) interface, so
the playground stops being a mock and starts compiling/running arbitrary CaMPL.

This is the substantial track. It is independent of the UI work — the UI is
already done and will not change when the engine is swapped.

## Why this is tractable

- The whole toolchain is Haskell (GHC). GHC has a first-class
  **WebAssembly backend** (`wasm32-wasi`) with a **JavaScript FFI (JSFFI)**.
- The frontend is **pure**: `MplCliRunner.Runner` already exposes
  `cliRunPipelineInputProg :: String -> MplCli ()` that takes the program **as a
  string** — no filesystem needed for single-file programs.
- The machine ↔ terminal boundary is a **single, well-defined seam** (a socket
  carrying a small message protocol in `MPLMACH`). Replace the transport and the
  machine runs unchanged.

## The three problems to solve

### A. Build GHC → wasm

The repo pins `lts-20.26` (GHC 9.2.x). The wasm backend needs **GHC ≥ 9.6**
(prefer 9.10/9.12). Plan:

1. Add a wasm build using [`ghc-wasm-meta`](https://gitlab.haskell.org/ghc/ghc-wasm-meta)
   (`wasm32-wasi-cabal` / `wasm32-wasi-ghc`), separate from the existing Stack
   build so native `mpl` keeps working.
2. Bump the resolver / dependency bounds to a GHC the wasm backend supports and
   fix the fallout (mostly `optics`, `recursion-schemes`, `prettyprinter`,
   `parsec` — all have compatible versions).
3. Build with the **non-threaded RTS**. Today `MPLCLI` uses
   `-threaded -with-rtsopts=-N`; the wasm target must drop `-threaded`. The
   machine's concurrency is green threads (`forkIO`/`async`/`MVar`), which the
   single-threaded RTS scheduler runs fine cooperatively.

### B. Replace the socket transport in the machine

`MPLMACH` (`MplMachRunner.hs`, `MplMachStack.hs`) uses `Network.Socket` to talk to
service processes (host/port live in `MplMachServicesEnv`). Browsers have no TCP.

1. **Introduce a transport typeclass** in `MPLMACH` — e.g.
   `class ServiceTransport t where sendMsg / recvMsg / openService / closeService`.
2. Factor the existing socket code into a `SocketTransport` instance (native,
   unchanged behaviour).
3. Add a `JsBridgeTransport` instance for wasm that, instead of writing bytes to a
   socket, calls **exported JS callbacks** via JSFFI:
   - machine `put`/`hput ...Put` → `foreign import javascript "onOutput(...)"`
   - machine `get`/`...Get`      → suspends the green thread until JS delivers a
     line (a promise/`MVar` filled from `sendInput`)
   - service open/close          → `onServiceOpen` / `onServiceClose`
   These map **1:1** onto `RunCallbacks` in `engine.ts`.

### C. Expose entry points via JSFFI

Compile as a **WASI reactor** (no `main`; exported functions), and export:

```haskell
foreign export javascript "camplCompile"
  camplCompile :: JSString -> IO JSVal   -- → { ok, diagnostics, stages }

foreign export javascript "camplRun"
  camplRun :: JSString -> IO ()          -- drives the machine; streams via JS callbacks
```

`camplCompile` runs the frontend + assembler and serialises the six dump stages
(`parsed … assembled`) and any `MplPassesErrors` into a JSON payload — the same
data `CompileResult` already models. `camplRun` starts the machine with the
`JsBridgeTransport`.

## Wiring it into the app

1. Emit `mpl.wasm` + JS glue; place under `public/` (or import as a Vite asset).
2. Instantiate with a browser WASI shim
   (e.g. [`@bjorn3/browser_wasi_shim`](https://github.com/bjorn3/browser_wasi_shim)),
   ideally inside a **Web Worker** so compiling/running never blocks the UI thread.
3. Implement `WasmEngine implements CamplEngine`:
   - `compile()` → `await camplCompile(source)`, parse JSON into `CompileResult`.
   - `run()` → set up JS-side service handlers that forward to `RunCallbacks`,
     call `camplRun(source)`, and return a `RunHandle` whose `sendInput` resolves
     the machine's pending `get` and whose `stop` tears down the worker.
4. Flip `getEngine()` in [`provider.ts`](../app/campl/provider.ts) (or gate on
   `VITE_CAMPL_ENGINE=wasm`). **No component changes.**

## Scope / milestones

1. **M1 — Compile-only. ✅ DONE.** The MPL frontend is built to `wasm32-wasi`
   (GHC 9.10) and wired via `camplCompile`. The Stages and Problems tabs are
   real: genuine parse → rename → typecheck → pattern-compile → lambda-lift dumps
   and diagnostics with source locations. Run still uses the mock. See
   [`../wasm/`](../wasm/) and the notes below.
2. **M2 — Run on the machine. ✅ DONE.** MPLASM + MPLMACH are built to wasm; the
   socket/process service layer is replaced with a JS bridge; `camplRun`
   assembles and runs the program. `helloworld`, `helloworld-terminal`,
   `echo-until-quit`, `split-console` all run for real — output *and* interactive
   input, one xterm pane per service. See the M2 as-built notes below.
3. **M3 — Robustness.** Type-ahead input buffering, richer service metadata
   (Console vs StringTerminal titles), timeouts/races stress-tested at scale.
4. **M4 — Modules & stdlib.** Bundle `mpl-lib` into a virtual FS so `import`/module
   resolution works, lifting the single-file limitation.

## Risks & mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Resolver/GHC bump breaks the build | Do it on a branch; keep the Stack build as the reference; bisect dep bounds. |
| RTS/concurrency differences on wasm | Green threads + `MVar` are supported single-threaded; avoid `-threaded`-only APIs. Validate with `split-console` early. |
| `.wasm` payload size | Serve compressed, lazy-load on first Run, run in a Worker; acceptable for a demo/education tool. |
| `get` blocking under cooperative scheduling | Model input as an `MVar`/promise the JS side fills; the green thread parks, the RTS keeps scheduling others. |

## M1 as-built notes

What it actually took to get the frontend compiling to wasm:

- **Toolchain:** `ghc-wasm-meta` (`FLAVOUR=9.10` → GHC 9.10.3 wasm) for
  `wasm32-wasi-ghc`/`-cabal`; plus native `alex`+`happy` on PATH (the BNFC
  lexer/parser generators, run as host build tools). Build with `wasm/build.sh`.
- **cabal.project** pulls in only `../../campl/MPL` (+ Hackage deps). MPLASM/MPLMACH
  are excluded — MPLASM depends on MPLMACH's `Network.Socket`, so `assembled`
  waits for M2.
- **GHC 9.2 → 9.10 source patches** (in `../campl`, all backward-compatible):
  - add explicit imports no longer re-exported transitively: `Control.Monad`
    (`void`, `guard`, `replicateM`, `(<=<)`, `(>=>)`), `Control.Monad.Fix`
    (`MonadFix`), `Data.Monoid` (`All`/`Any`/`First` + getters).
  - `forall` is now a reserved word → renamed a term variable in `TypeEqns.hs`.
  - deleted a handful of local `where`-helper **partial type signatures**
    (`f :: … _ (…)`) in the renamer/typechecker/lambda-lifter: GHC 9.10 no longer
    infers the `Monad`/`Applicative` constraint for a wildcard whose monad isn't
    lexically nameable. Removing the signature lets GHC infer the whole type.
- **Entry point** `wasm/mpl-wasm/src/CamplWasm.hs`: a reactor exporting
  `camplCompile :: JSString -> IO JSString` (via `GHC.Wasm.Prim`, needs
  `ghc-experimental`) that runs the staged pipeline and hand-rolls the JSON.
- **Host:** `WasmEngine` loads the module in a Web Worker with
  `@bjorn3/browser_wasi_shim`; `wasi.initialize` + `hs_init(0,0)` for the reactor.
  Vite needs `worker.format: "es"` (the JSFFI glue is an ESM with top-level await).

## M2 as-built notes

Getting the abstract machine into the browser:

- **MPLMACH depends on `network` (sockets) and `process` (it spawns Alacritty).**
  Neither builds for wasm. In `MPLMACH.cabal`, `if arch(wasm32)` drops both and
  adds `ghc-experimental` + `-DWASM`; the socket/process code is `#ifdef`-guarded
  out so the native build is untouched.
- **The service seam.** The machine already had an in-process, stdio-based service
  handler (`serviceThread`) beside the socket one — proof the socket path was just
  *one* transport. The wasm build adds `wasmServiceThread`, a mirror that does I/O
  through four JSFFI imports — `__camplSvOpen/Put/Get/Close` — provided by the host
  worker. `sOpenTerm` (and, on wasm, `SHOpenThread` — the "main console") open a JS
  xterm pane and fork this handler instead of spawning a process. The socket
  server (`serviceManager`/`serviceClient`/`recvPipe`) is compiled out on wasm.
- **Blocking `get`.** `__camplSvGet` is a `foreign import javascript safe` returning
  a Promise; the green thread parks until the worker resolves it with a typed line.
  The RTS scheduler (driven by the JSFFI `scheduleWork`/`setImmediate` glue) wakes
  it — verified end-to-end (`echo-until-quit` loops on scripted input and exits).
- **Entry point** `camplRun :: JSString -> IO JSString`: compile → `mplAssembleProg`
  → `mplAsmProgToInitMachState` → `initMplMachEnv` → the wasm `mplMachRunnner`
  (no socket server; waits for services to drain, then returns a JSON status).
- **Host.** The worker sets the `__camplSv*` globals, calls `camplRun`, forwards
  `svOpen/svPut/svClose` to the main thread and resolves `svGet` from `input`
  messages. `WasmEngine.run` maps those to `RunCallbacks`/xterm; `stop()` terminates
  the worker (the only reliable way to kill a runaway machine). The `RunBus` buffers
  output emitted before xterm mounts (the machine is faster than the terminal), and
  terminals are keyed by a per-run nonce so re-runs get fresh panes.

Same GHC 9.10 patch pattern as M1 (a few missing `Control.Monad`/`Data.Monoid`
imports across MPLMACH/MPLASM), on branch `wasm-ghc910-port` in `../campl`.

## Fallback: `ServerEngine`

If the wasm build lags, a `ServerEngine` can implement the same interface by
POSTing source to a tiny service that shells out to the native `mpl` binary and
streams service I/O over a WebSocket. Same `CamplEngine`, same UI — useful for
local development and as an interim hosted demo.
