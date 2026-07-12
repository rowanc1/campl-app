import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  // The GHC-wasm JSFFI glue is an ES module with top-level await, so the
  // wasm worker must be bundled as an ES module (not the default IIFE).
  worker: {
    format: "es",
  },
});
