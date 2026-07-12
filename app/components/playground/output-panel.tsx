import { Circle, Terminal as TerminalIcon } from "lucide-react";
import type { CompileResult, ServiceHandle } from "~/campl/engine";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { DiagnosticsView } from "./diagnostics-view";
import type { RunBus } from "./run-bus";
import { StagesView } from "./stages-view";
import { TerminalView } from "./terminal-view";

export type RunStatus =
  | { kind: "idle" }
  | { kind: "compiling" }
  | { kind: "running" }
  | { kind: "exited"; code: number }
  | { kind: "error"; message: string };

interface OutputPanelProps {
  tab: string;
  onTabChange: (tab: string) => void;
  services: ServiceHandle[];
  closedIds: Set<string>;
  bus: RunBus;
  status: RunStatus;
  result: CompileResult | null;
}

function statusText(s: RunStatus): { label: string; className: string } {
  switch (s.kind) {
    case "running":
      return { label: "running", className: "text-emerald-500" };
    case "compiling":
      return { label: "compiling…", className: "text-sky-500" };
    case "exited":
      return {
        label: `exited (${s.code})`,
        className: s.code === 0 ? "text-muted-foreground" : "text-amber-500",
      };
    case "error":
      return { label: "error", className: "text-destructive" };
    default:
      return { label: "idle", className: "text-muted-foreground" };
  }
}

export function OutputPanel({
  tab,
  onTabChange,
  services,
  closedIds,
  bus,
  status,
  result,
}: OutputPanelProps) {
  const problemCount = result?.diagnostics.length ?? 0;
  const st = statusText(status);

  return (
    <Tabs
      value={tab}
      onValueChange={onTabChange}
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-2 py-1.5">
        <TabsList className="bg-transparent p-0">
          <TabsTrigger value="run" className="gap-1.5 text-xs">
            <TerminalIcon className="size-3.5" /> Run
          </TabsTrigger>
          <TabsTrigger value="stages" className="text-xs">
            Compiler Stages
          </TabsTrigger>
          <TabsTrigger value="problems" className="gap-1.5 text-xs">
            Problems
            {problemCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {problemCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <div className="ml-auto flex items-center gap-1.5 px-2 text-xs">
          <Circle
            className={cn(
              "size-2 fill-current",
              st.className,
              status.kind === "running" && "animate-pulse"
            )}
          />
          <span className={st.className}>{st.label}</span>
        </div>
      </div>

      <TabsContent value="run" className="min-h-0 flex-1 overflow-hidden">
        {services.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <TerminalIcon className="size-6 opacity-40" />
            <p>
              Press <span className="font-medium text-foreground">Run</span> to
              start the abstract machine. Terminals opened by the program appear
              here.
            </p>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col divide-y divide-border/60">
            {services.map((svc) => {
              const closed = closedIds.has(svc.id);
              return (
                <div key={svc.id} className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5">
                    <TerminalIcon className="size-3.5 text-primary" />
                    <span className="text-xs font-medium">{svc.title}</span>
                    <Badge
                      variant="outline"
                      className="h-4 px-1.5 font-mono text-[10px]"
                    >
                      {svc.kind}
                    </Badge>
                    {closed && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        closed
                      </span>
                    )}
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden bg-black/40 p-2">
                    <TerminalView service={svc} bus={bus} active={!closed} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="stages" className="min-h-0 flex-1 overflow-hidden">
        <StagesView result={result} />
      </TabsContent>

      <TabsContent value="problems" className="min-h-0 flex-1 overflow-hidden">
        <DiagnosticsView result={result} />
      </TabsContent>
    </Tabs>
  );
}
