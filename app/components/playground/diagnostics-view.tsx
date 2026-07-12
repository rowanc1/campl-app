import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { CompileResult, Diagnostic } from "~/campl/engine";
import { ScrollArea } from "~/components/ui/scroll-area";

const ICON = {
  error: <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />,
  warning: <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />,
  info: <Info className="mt-0.5 size-4 shrink-0 text-sky-500" />,
} satisfies Record<Diagnostic["severity"], React.ReactNode>;

export function DiagnosticsView({ result }: { result: CompileResult | null }) {
  if (!result) {
    return <Empty text="No diagnostics yet." />;
  }
  if (result.diagnostics.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <CheckCircle2 className="size-6 text-emerald-500" />
        <p className="text-sm text-muted-foreground">
          No problems found. Compiled in {result.durationMs}ms.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <ul className="divide-y divide-border/60">
        {result.diagnostics.map((d, i) => (
          <li key={i} className="flex gap-2.5 px-3 py-2.5 text-sm">
            {ICON[d.severity]}
            <div className="min-w-0">
              <p className="text-foreground/90">{d.message}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {d.stage}
                {d.line != null && `  ·  line ${d.line}`}
                {d.column != null && `:${d.column}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
