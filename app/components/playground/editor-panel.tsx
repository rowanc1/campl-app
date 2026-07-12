import { Editor, type Monaco } from "@monaco-editor/react";
import "~/campl/monaco.client";
import { ChevronDown, FlaskConical, Loader2, Play, Square } from "lucide-react";
import { MPL_LANGUAGE_ID, registerMplLanguage } from "~/campl/mpl-language";
import { EXAMPLES, type Example } from "~/campl/examples";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const LEVEL_LABEL: Record<Example["level"], string> = {
  intro: "Intro",
  interactive: "Interactive",
  concurrent: "Concurrent",
};

interface EditorPanelProps {
  source: string;
  onChange: (value: string) => void;
  example: Example;
  onSelectExample: (id: string) => void;
  onRun: () => void;
  onStop: () => void;
  running: boolean;
  compiling: boolean;
}

function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme("campl-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "c4b5fd", fontStyle: "bold" },
      { token: "keyword.control", foreground: "f0abfc" },
      { token: "type", foreground: "5eead4" },
      { token: "type.identifier", foreground: "7dd3fc" },
      { token: "string", foreground: "bef264" },
      { token: "string.escape", foreground: "fbbf24" },
      { token: "number", foreground: "fca5a5" },
      { token: "comment", foreground: "6b7280", fontStyle: "italic" },
      { token: "operator", foreground: "e879f9" },
    ],
    colors: {
      "editor.background": "#0a0a0a00",
      "editor.lineHighlightBackground": "#ffffff08",
      "editorLineNumber.foreground": "#4b5563",
      "editorGutter.background": "#00000000",
    },
  });
}

export function EditorPanel({
  source,
  onChange,
  example,
  onSelectExample,
  onRun,
  onStop,
  running,
  compiling,
}: EditorPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <FlaskConical className="size-3.5 text-primary" />
              <span className="max-w-40 truncate">{example.title}</span>
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Example programs</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {EXAMPLES.map((e) => (
              <DropdownMenuItem
                key={e.id}
                onSelect={() => onSelectExample(e.id)}
                className="flex-col items-start gap-0.5"
              >
                <div className="flex w-full items-center gap-2">
                  <span className="font-medium">{e.title}</span>
                  <Badge
                    variant="secondary"
                    className="ml-auto text-[10px] font-normal"
                  >
                    {LEVEL_LABEL[e.level]}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {e.summary}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-1 hidden flex-wrap gap-1 md:flex">
          {example.concepts.slice(0, 4).map((c) => (
            <Badge key={c} variant="outline" className="font-mono text-[10px]">
              {c}
            </Badge>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {running ? (
            <Button size="sm" variant="destructive" onClick={onStop}>
              <Square className="size-3.5 fill-current" />
              Stop
            </Button>
          ) : (
            <Button size="sm" onClick={onRun} disabled={compiling}>
              {compiling ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5 fill-current" />
              )}
              Run
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <Editor
          language={MPL_LANGUAGE_ID}
          theme="campl-dark"
          value={source}
          onChange={(v) => onChange(v ?? "")}
          beforeMount={(monaco) => {
            registerMplLanguage(monaco);
            defineTheme(monaco);
          }}
          options={{
            fontFamily:
              '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            padding: { top: 12, bottom: 12 },
            tabSize: 4,
            renderLineHighlight: "line",
            fixedOverflowWidgets: true,
          }}
          loading={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading editor…
            </div>
          }
        />
      </div>
    </div>
  );
}
