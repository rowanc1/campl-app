import { useEffect, useState } from "react";
import { COMPILE_STAGES, type CompileResult } from "~/campl/engine";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";

interface StagesViewProps {
  result: CompileResult | null;
}

export function StagesView({ result }: StagesViewProps) {
  const [active, setActive] = useState(COMPILE_STAGES[0].id);

  useEffect(() => {
    if (result?.stages.length) setActive(result.stages[result.stages.length - 1].stage);
  }, [result]);

  if (!result) {
    return (
      <EmptyHint text="Run or compile a program to inspect each stage of the CaMPL pipeline." />
    );
  }
  if (!result.ok || result.stages.length === 0) {
    return (
      <EmptyHint text="Compilation reported errors — see the Problems tab." />
    );
  }

  const dump = result.stages.find((s) => s.stage === active);
  const meta = COMPILE_STAGES.find((s) => s.id === active);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-1 border-b border-border/60 p-2">
        {COMPILE_STAGES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={cn(
              "rounded-md px-2.5 py-1 font-mono text-xs transition-colors",
              active === s.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <span className="opacity-50">{i + 1}.</span> {s.label}
          </button>
        ))}
      </div>
      {meta && (
        <p className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
          {meta.blurb}
        </p>
      )}
      <ScrollArea className="min-h-0 flex-1">
        <pre className="p-3 font-mono text-xs leading-relaxed text-foreground/90">
          {dump?.output}
        </pre>
      </ScrollArea>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
