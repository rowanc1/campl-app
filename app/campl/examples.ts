import helloworld from "./examples/helloworld.mpl?raw";
import helloworldTerminal from "./examples/helloworld-terminal.mpl?raw";
import echoUntilQuit from "./examples/echo-until-quit.mpl?raw";
import splitConsole from "./examples/split-console.mpl?raw";

export interface Example {
  id: string;
  title: string;
  /** One-line description shown in the picker. */
  summary: string;
  /** Concepts this example showcases. */
  concepts: string[];
  source: string;
  /** Difficulty ordering hint. */
  level: "intro" | "interactive" | "concurrent";
}

/**
 * Bundled example programs, taken verbatim from the CaMPL repository
 * (MPLCLI/examples). The mock engine (mock-engine.ts) knows how to "run"
 * these by id; editing the source falls back to a generic run.
 */
export const EXAMPLES: Example[] = [
  {
    id: "helloworld",
    title: "Hello World",
    summary: "Put a string on the console, then close the channel.",
    concepts: ["coprotocol", "hput", "put", "halt"],
    source: helloworld,
    level: "intro",
  },
  {
    id: "helloworld-terminal",
    title: "Hello Terminal",
    summary: "Open a string terminal, print a prompt, wait for a keypress.",
    concepts: ["protocol", "Get", "Put", "get"],
    source: helloworldTerminal,
    level: "interactive",
  },
  {
    id: "echo-until-quit",
    title: "Echo Until Quit",
    summary: "Read input in a loop and echo it back until the user types 'q'.",
    concepts: ["recursion", "fun", "if/then/else", "get/put"],
    source: echoUntilQuit,
    level: "interactive",
  },
  {
    id: "split-console",
    title: "Split Console",
    summary: "Fork a console into two channels and plug them together concurrently.",
    concepts: ["split", "plug", "fork", "Neg", "(*)"],
    source: splitConsole,
    level: "concurrent",
  },
];

export const DEFAULT_EXAMPLE_ID = "helloworld";

export function getExample(id: string): Example | undefined {
  return EXAMPLES.find((e) => e.id === id);
}
