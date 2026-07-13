/**
 * Client-only Monaco setup. The `.client` suffix keeps this out of the SSR
 * bundle (monaco touches `self`/DOM at import time).
 *
 * We self-host Monaco from the npm package instead of the default jsDelivr CDN
 * so the playground works offline and pins an exact version. Only the base
 * editor worker is wired up — we use a custom Monarch grammar, not Monaco's
 * built-in TS/JSON/CSS language services.
 */
import { loader } from "@monaco-editor/react";
// Import only the editor core (not the TS/JSON/CSS/HTML language features) —
// we register a custom Monarch grammar, so those megabytes of workers are dead
// weight. This keeps the bundle small.
// `edcore.main` is the editor core PLUS its contributions (hover, bracket
// matching, suggest, find, …) but WITHOUT the TS/JSON/CSS/HTML language
// features — so we keep marker hovers while still skipping those megabyte
// workers. (`editor.api` alone omits the hover controller entirely.)
// @ts-expect-error -- deep import has no bundled type declaration; resolved by Vite at runtime
import * as monaco from "monaco-editor/esm/vs/editor/edcore.main";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

loader.config({ monaco });
