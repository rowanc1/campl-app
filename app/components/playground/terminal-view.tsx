import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import type { ServiceHandle } from "~/campl/engine";
import type { RunBus } from "./run-bus";

const nl = (s: string) => s.replace(/\n/g, "\r\n");

interface TerminalViewProps {
  service: ServiceHandle;
  bus: RunBus;
  /** Whether this service still accepts input. */
  active: boolean;
}

/**
 * One xterm.js pane bound to a CaMPL service. Program output is written
 * verbatim; user keystrokes are line-buffered (with local echo) and sent back
 * to the machine on Enter.
 */
export function TerminalView({ service, bus, active }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let disposed = false;
    let cleanupBus: (() => void) | undefined;
    let term: import("@xterm/xterm").Terminal | undefined;
    let onResize: (() => void) | undefined;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed || !containerRef.current) return;

      term = new Terminal({
        fontFamily:
          '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13,
        cursorBlink: true,
        convertEol: false,
        theme: {
          background: "#00000000",
          foreground: "#e5e7eb",
          cursor: "#a78bfa",
          selectionBackground: "#6d28d955",
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();

      onResize = () => {
        try {
          fit.fit();
        } catch {
          /* ignore */
        }
      };
      window.addEventListener("resize", onResize);

      // Program → terminal.
      cleanupBus = bus.subscribe(service.id, (text) => term?.write(nl(text)));

      // Terminal → program (line buffered with echo).
      let line = "";
      term.onData((data) => {
        if (!activeRef.current) return;
        for (const ch of data) {
          const code = ch.charCodeAt(0);
          if (ch === "\r" || ch === "\n") {
            term!.write("\r\n");
            bus.input(service.id, line);
            line = "";
          } else if (code === 127 || ch === "\b") {
            if (line.length > 0) {
              line = line.slice(0, -1);
              term!.write("\b \b");
            }
          } else if (code >= 32) {
            line += ch;
            term!.write(ch);
          }
        }
      });

      term.focus();
    })();

    return () => {
      disposed = true;
      cleanupBus?.();
      if (onResize) window.removeEventListener("resize", onResize);
      term?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id]);

  return <div ref={containerRef} className="h-full w-full" />;
}
