import helloworld from "./examples/helloworld.mpl?raw";
import helloworldTerminal from "./examples/helloworld-terminal.mpl?raw";
import echoUntilQuit from "./examples/echo-until-quit.mpl?raw";
import splitConsole from "./examples/split-console.mpl?raw";
import memoryCell from "./examples/memory-cell.mpl?raw";
import messageBoard from "./examples/message-board.mpl?raw";
import racedMemoryCell from "./examples/raced-memory-cell.mpl?raw";
import ticTacToe from "./examples/tic-tac-toe.mpl?raw";

export interface Example {
  id: string;
  title: string;
  /** One-line description shown in the picker. */
  summary: string;
  /** Concepts this example showcases. */
  concepts: string[];
  source: string;
  /** Difficulty ordering hint. */
  level: "intro" | "interactive" | "concurrent" | "game";
}

/**
 * Bundled example programs, taken verbatim from the CaMPL repository
 * (MPLCLI/examples). They compile and run on the real WebAssembly toolchain;
 * the concurrent ones open several terminals at once.
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
  {
    id: "memory-cell",
    title: "Memory Cell",
    summary:
      "Two terminals share a mutable memory cell — write from one, read from the other.",
    concepts: ["memory cell", "protocol", "fork", "plug"],
    source: memoryCell,
    level: "concurrent",
  },
  {
    id: "message-board",
    title: "Message Board",
    summary:
      "Two writer terminals post to a shared board using a race, with no turn-taking.",
    concepts: ["race", "id", "fork", "split"],
    source: messageBoard,
    level: "concurrent",
  },
  {
    id: "raced-memory-cell",
    title: "Raced Memory Cell",
    summary:
      "Two clients race for a lock on a memory cell, then read and update its value.",
    concepts: ["race", "memory cell", "protocol", "recursion"],
    source: racedMemoryCell,
    level: "concurrent",
  },
  {
    id: "tic-tac-toe",
    title: "Tic Tac Toe",
    summary:
      "A two-player game: each player gets a terminal, sharing the board via a memory cell.",
    concepts: ["memory cell", "data", "codata", "fork", "race"],
    source: ticTacToe,
    level: "game",
  },
];

export const DEFAULT_EXAMPLE_ID = "helloworld";

export function getExample(id: string): Example | undefined {
  return EXAMPLES.find((e) => e.id === id);
}
