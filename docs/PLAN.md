# CaMPL Playground — Plan & Architecture

This document captures the analysis of the CaMPL compiler and the design of the
web demo built on top of it.

## 1. What is in the `campl` repository

`campl` is a Haskell monorepo (Stack, resolver `lts-20.26` → GHC 9.2.x). Its
`stack.yaml` lists many packages, but they are **not** all part of the current
language. They fall into two groups:

| Active (used by the `mpl` CLI)   | Legacy / experimental prototypes         |
| -------------------------------- | ---------------------------------------- |
| `MPL` — compiler frontend        | `AMPL`, `AMPLASM`, `AMPLC`               |
| `MPLASM` — assembler             | `CMPL`, `MPL2`                           |
| `MPLMACH` — abstract machine     | `MPLCLIENT`                              |
| `MPLCLI` — the `mpl` executable  |                                          |
| `mpl-lib` — standard library     |                                          |

**The canonical entry point is `MPLCLI`**, which builds the `mpl` binary. Its
`.cabal` depends on exactly `MPL`, `MPLASM`, and `MPLMACH` — confirming those
three are the live pipeline. Everything else is earlier research code.

### The compilation pipeline

`MPLCLI`'s runner (`MplCliRunner.Runner`) drives these stages, each of which the
CLI can dump with `mpl --dump-<stage>`:

```
parsed → renamed → type-checked → pattern-compiled → lambda-lifted → assembled
```

- **MPL** does parse (BNFC) → module resolution → rename → typecheck → pattern
  compile → lambda lift.
- **MPLASM** turns the lambda-lifted AST into AMPL abstract-machine instructions.
- **MPLMACH** executes the instructions.

These named stages are a gift for a demo: they let us show *how* a concurrent,
protocol-typed program is lowered, not just its output. The playground surfaces
them in the **Compiler Stages** tab.

### The runtime & "services" (the key architectural insight)

`mpl --run file.mpl` starts MPLMACH, which:

1. opens a **TCP server** (default `127.0.0.1:3000`, see `MplMachStack.hs`),
2. forks a *service manager* thread, and
3. spawns external **Alacritty terminals** that connect back as **services**.

The two protocols a program talks to a service with are:

- `Console` (a **coprotocol**) — the program `put`s strings out and `close`s it.
- `StringTerminal` (a **protocol**) — supports `Get`, `Put`, and `Close`, i.e.
  interactive input *and* output.

So the machine ↔ terminal boundary is a **socket carrying a small message
protocol**. That single seam is:

- how the web demo attaches terminals (one xterm pane per service), and
- the exact place the WebAssembly port replaces the socket with an in-browser
  channel (see `WASM_PLAN.md`).

## 2. The example we build the demo around

The bundled examples are taken **verbatim** from `MPLCLI/examples/`, chosen to
climb a difficulty ladder while each staying short enough to read on screen:

| Example              | Protocol         | Shows                                              |
| -------------------- | ---------------- | ------------------------------------------------- |
| `helloworld`         | `Console`        | `coprotocol`, `hput`, `put`, `halt` — output only |
| `helloworld-terminal`| `StringTerminal` | `protocol`, `Get`/`Put`, waiting on input         |
| `echo-until-quit`    | `Console`        | `fun`, recursion, `if/then/else`, a get/put loop  |
| `split-console`      | both             | `split`, `plug`, `fork`, `Neg`, `(*)` — concurrency|

`helloworld` is the canonical "main example": it is the smallest complete program
that exercises a protocol, a process, and the `run` entry point. The landing page
hero shows it; the playground opens on it by default.

**What a run looks like in the demo.** Pressing **Run** compiles the source (all
six stages populate), then starts the machine. As the program opens services, an
xterm terminal appears for each — labelled `Console` or `Terminal`. Program
`put`s stream into the terminal; when the program `get`s, the terminal accepts a
line of typed input (local echo, submit on Enter) and delivers it back. The
status chip tracks `compiling → running → exited (code)`.

## 3. Web-app architecture

### The engine seam

```ts
interface CamplEngine {
  compile(source): Promise<CompileResult>   // diagnostics + 6 stage dumps
  run(source, callbacks): Promise<RunHandle> // opens services, streams I/O
}
```

Two implementations share it:

- **`MockEngine`** (today) — derives illustrative stage dumps from the source and
  plays a scripted interaction per example. It makes the entire UI real and
  demoable with zero backend, and clearly labels its output as mock.
- **`WasmEngine`** (planned) — loads the GHC-wasm build of `mpl` and bridges the
  service protocol to the browser. Same interface, no UI changes.

`getEngine()` (`provider.ts`) is the only place that names a concrete engine.

### UI

- **Landing (`/`)** — explains CaMPL's four differentiators (typed concurrency,
  deadlock/livelock freedom, controlled non-determinism, data & codata) and links
  each example into the playground.
- **Playground (`/play`)** — split view:
  - *left*: Monaco editor with a custom `.mpl` Monarch grammar + example picker.
  - *right*: tabs — **Run** (xterm terminals), **Compiler Stages** (the six
    dumps with a stepper), **Problems** (diagnostics).
- A `RunBus` event bridge routes machine output to the right terminal and typed
  input back to the machine, decoupling xterm lifecycles from React state.

### Notable implementation choices

- **Monaco is self-hosted** from the npm package (not the default jsDelivr CDN)
  via a `.client` module, so the playground works offline and pins a version.
- **xterm is loaded client-only** (dynamic import inside an effect) to stay
  SSR-safe under React Router's server rendering.
- Terminal input submits on `\r` **or** `\n` so pasted/`\n`-terminated input also
  works, not just interactive Enter.

## 4. Status & next steps

- [x] Scaffold: React Router 8 + Tailwind 4 + shadcn, dark theme, chrome.
- [x] Engine abstraction + mock engine + example registry.
- [x] Playground: editor, `.mpl` highlighting, stages, diagnostics, terminals.
- [x] Landing page.
- [x] `WasmEngine` **(M1)**: MPL frontend compiled to wasm; real stages +
      diagnostics (with editor squiggles). See `WASM_PLAN.md`.
- [x] **M2**: MPLASM + MPLMACH compiled to wasm; the socket/process service layer
      replaced with a JS bridge; `run()` executes any program on the real machine
      with live xterm terminals (output + interactive input). See `WASM_PLAN.md`.
- [ ] Persist/share programs via URL; deep-link the active stage.
- [ ] More examples (memory cell, message board, tic-tac-toe) — the engine now
      runs arbitrary programs.
