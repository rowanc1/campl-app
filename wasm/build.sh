#!/usr/bin/env bash
# Build the CaMPL frontend (MPL) to WebAssembly and stage it into the web app.
#
# Prerequisites (one-time):
#   - GHC wasm toolchain via ghc-wasm-meta (FLAVOUR=9.10), sourced from ~/.ghc-wasm/env
#   - native alex + happy on PATH (the BNFC lexer/parser generators):
#       cabal install alex happy   # with any native GHC
#
# Produces:
#   out/mpl-wasm.wasm         the reactor module (exports camplCompile)
#   out/ghc_wasm_jsffi.js     the JSFFI glue emitted by GHC's post-linker
# and copies them into ../public/wasm and ../app/campl/wasm.
set -euo pipefail

cd "$(dirname "$0")"
source ~/.ghc-wasm/env
export PATH="$HOME/.local/bin:$PATH"   # native alex/happy

echo ">> building mpl-wasm (wasm32-wasi)…"
wasm32-wasi-cabal build mpl-wasm

WASM=$(wasm32-wasi-cabal list-bin mpl-wasm)
LIBDIR=$(wasm32-wasi-ghc --print-libdir)

mkdir -p out
echo ">> post-linking JSFFI glue…"
"$LIBDIR/post-link.mjs" -i "$WASM" -o out/ghc_wasm_jsffi.js
cp "$WASM" out/mpl-wasm.wasm

echo ">> staging into the web app…"
cp out/mpl-wasm.wasm ../public/wasm/mpl-wasm.wasm
cp out/ghc_wasm_jsffi.js ../app/campl/wasm/ghc_wasm_jsffi.js

echo ">> done. $(du -h out/mpl-wasm.wasm | cut -f1) wasm staged."
