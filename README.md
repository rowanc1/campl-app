# CaMPL Playground (`campl-app`)

An interactive web demo for **CaMPL** — the **Ca**tegorical **M**essage **P**assing
**L**anguage, a typed, functional-style concurrent language from the University of
Calgary in which processes communicate by passing messages on typed channels.

The app lets you edit CaMPL programs, watch them go through the compiler pipeline,
and run them against a browser-hosted abstract machine — with each channel the
program opens rendered as a live terminal.

> **Status:** the UI is complete and runs on a **mock engine** (scripted outputs
> for the bundled examples). The real compiler is a Haskell toolchain being ported
> to WebAssembly — see [`docs/WASM_PLAN.md`](docs/WASM_PLAN.md). The engine is
> abstracted behind a single interface so the WASM build is a drop-in swap.

## Stack

- [React Router 8](https://reactrouter.com) (framework mode, SSR) + [Vite](https://vite.dev)
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Monaco](https://microsoft.github.io/monaco-editor/) editor (self-hosted, custom `.mpl` grammar)
- [xterm.js](https://xtermjs.org) terminals
- [Bun](https://bun.sh) as package manager / runtime

## Getting started

Requires **Bun** and **Node ≥ 22.22** (React Router 8's dev server checks the Node
version; Bun is used for installs and scripts).

```sh
bun install
bun run dev        # http://localhost:5173
bun run typecheck  # react-router typegen + tsc
bun run build      # production build (client + SSR)
```

## How it works

The real CaMPL compiler is a Haskell monorepo. Its `mpl` binary chains three
packages:

```
 .mpl source
    │  MPL      frontend:  parse → rename → typecheck → pattern-compile → lambda-lift
    ▼  MPLASM   assembler: lambda-lifted AST → AMPL machine instructions
    ▼  MPLMACH  abstract machine: executes instructions, talks to "services"
    ▼
 terminals (Console / StringTerminal)
```

In the CLI those *services* are external Alacritty terminals connected over a
TCP socket. This app models the same shape: the [`CamplEngine`](app/campl/engine.ts)
interface exposes `compile()` (returning per-stage dumps + diagnostics) and
`run()` (streaming service I/O), and the UI maps every service to an xterm pane.

### Project layout

```
app/
  campl/
    engine.ts          CamplEngine interface + shared types (the seam)
    mock-engine.ts     scripted backend for the bundled examples (current)
    provider.ts        engine singleton — swap MockEngine → WasmEngine here
    examples.ts        example registry
    examples/*.mpl     real programs, verbatim from the CaMPL repo
    mpl-language.ts    Monaco Monarch grammar for .mpl
    monaco.client.ts   self-hosts Monaco (no CDN), client-only
  components/
    playground/        editor panel, output panel, xterm view, stage/diagnostic views
    ui/                shadcn components
  routes/
    home.tsx           landing page
    play.tsx           the playground
docs/
  PLAN.md              architecture + example design
  WASM_PLAN.md         plan to compile the Haskell toolchain to WebAssembly
```

## Swapping in the real engine

Everything the UI needs is behind [`getEngine()`](app/campl/provider.ts). Once a
`WasmEngine` implements `CamplEngine`, change that one function (or branch on
`import.meta.env.VITE_CAMPL_ENGINE`) and the whole app runs against the real
compiler — no component changes required.

## Credits

CaMPL is developed at the University of Calgary:
<https://github.com/campl-ucalgary/campl>. This playground is an independent demo.
