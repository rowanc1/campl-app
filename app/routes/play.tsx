import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { CompileResult, RunHandle, ServiceHandle } from "~/campl/engine";
import {
  DEFAULT_EXAMPLE_ID,
  getExample,
  type Example,
} from "~/campl/examples";
import { getEngine } from "~/campl/provider";
import { EditorPanel } from "~/components/playground/editor-panel";
import {
  OutputPanel,
  type RunStatus,
} from "~/components/playground/output-panel";
import { RunBus } from "~/components/playground/run-bus";
import { SiteHeader } from "~/components/site-header";
import type { Route } from "./+types/play";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Playground · CaMPL" },
    {
      name: "description",
      content:
        "Write, compile, and run CaMPL — a typed concurrent language — in your browser.",
    },
  ];
}

export default function Play() {
  const [searchParams] = useSearchParams();
  const initialExample =
    getExample(searchParams.get("example") ?? DEFAULT_EXAMPLE_ID) ??
    getExample(DEFAULT_EXAMPLE_ID)!;
  const [example, setExample] = useState<Example>(initialExample);
  const [source, setSource] = useState(initialExample.source);

  const [result, setResult] = useState<CompileResult | null>(null);
  const [status, setStatus] = useState<RunStatus>({ kind: "idle" });
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("run");

  const [services, setServices] = useState<ServiceHandle[]>([]);
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());

  const busRef = useRef<RunBus>(new RunBus());
  const runHandleRef = useRef<RunHandle | null>(null);
  const engine = useMemo(() => getEngine(), []);

  // Live (debounced) compile so the Stages/Problems tabs stay current.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await engine.compile(source);
      if (!cancelled) setResult(res);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [source, engine]);

  const selectExample = useCallback(
    (id: string) => {
      const ex = getExample(id);
      if (!ex) return;
      runHandleRef.current?.stop();
      runHandleRef.current = null;
      setExample(ex);
      setSource(ex.source);
      setServices([]);
      setClosedIds(new Set());
      setStatus({ kind: "idle" });
      setRunning(false);
      setResult(null);
    },
    []
  );

  const stop = useCallback(() => {
    runHandleRef.current?.stop();
  }, []);

  const run = useCallback(async () => {
    if (running) return;
    setStatus({ kind: "compiling" });
    const res = await engine.compile(source);
    setResult(res);
    if (!res.ok) {
      setStatus({ kind: "error", message: "Compilation failed." });
      setTab("problems");
      return;
    }

    const bus = busRef.current;
    bus.reset();
    setServices([]);
    setClosedIds(new Set());
    setTab("run");
    setStatus({ kind: "running" });
    setRunning(true);

    const handle = await engine.run(source, {
      onServiceOpen: (svc) => setServices((prev) => [...prev, svc]),
      onOutput: (id, text) => bus.emit(id, text),
      onServiceClose: (id) =>
        setClosedIds((prev) => new Set(prev).add(id)),
      onExit: (code) => {
        setRunning(false);
        setStatus({ kind: "exited", code });
      },
      onError: (message) => {
        setRunning(false);
        setStatus({ kind: "error", message });
      },
    });
    bus.onInput = (id, text) => handle.sendInput(id, text);
    runHandleRef.current = handle;
  }, [engine, source, running]);

  // Stop any run on unmount.
  useEffect(() => () => runHandleRef.current?.stop(), []);

  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader />
      <main className="grid min-h-0 flex-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
        <section className="min-h-0 border-b border-border/60 lg:border-b-0 lg:border-r">
          <EditorPanel
            source={source}
            onChange={setSource}
            example={example}
            onSelectExample={selectExample}
            onRun={run}
            onStop={stop}
            running={running}
            compiling={status.kind === "compiling"}
          />
        </section>
        <section className="min-h-0">
          <OutputPanel
            tab={tab}
            onTabChange={setTab}
            services={services}
            closedIds={closedIds}
            bus={busRef.current}
            status={status}
            result={result}
          />
        </section>
      </main>
    </div>
  );
}
