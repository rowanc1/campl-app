import type { Monaco } from "@monaco-editor/react";

export const MPL_LANGUAGE_ID = "mpl";

let registered = false;

/** Register the CaMPL (.mpl) language: tokenizer, brackets, comments. */
export function registerMplLanguage(monaco: Monaco): void {
  if (registered) return;
  registered = true;

  monaco.languages.register({ id: MPL_LANGUAGE_ID, extensions: [".mpl"] });

  monaco.languages.setLanguageConfiguration(MPL_LANGUAGE_ID, {
    comments: { lineComment: "--", blockComment: ["{-", "-}"] },
    brackets: [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
    ],
    autoClosingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: "{", close: "}" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
    ],
  });

  monaco.languages.setMonarchTokensProvider(MPL_LANGUAGE_ID, {
    defaultToken: "",
    keywords: [
      "proc", "fun", "data", "codata", "protocol", "coprotocol",
      "defn", "where", "do", "let", "in", "of", "case",
      "if", "then", "else", "run",
    ],
    // Concurrency / channel operations get their own colour.
    processOps: [
      "get", "put", "hput", "hcase", "split", "fork", "plug",
      "close", "halt", "on", "into", "neg", "id", "race",
    ],
    typeKeywords: [
      "Char", "Int", "Bool", "Double", "String",
      "Get", "Put", "Neg", "TopBot",
    ],
    operators: [
      "=>", "->", "|=|", "::", "=", "|", ":", "==", "(*)", "(+)",
    ],
    symbols: /[=><!~?:&|+\-*/^%]+/,
    escapes: /\\(?:[nrtbf"'\\]|x[0-9A-Fa-f]+)/,

    tokenizer: {
      root: [
        // block/line comments
        [/\{-/, "comment", "@blockComment"],
        [/--.*$/, "comment"],

        // char & string literals
        [/'(?:[^'\\]|\\.)'/, "string"],
        [/"/, "string", "@string"],

        // numbers
        [/\d+\.\d+/, "number.float"],
        [/\d+/, "number"],

        // constructors / type names (Uppercase)
        [
          /[A-Z][\w']*/,
          { cases: { "@typeKeywords": "type", "@default": "type.identifier" } },
        ],

        // identifiers & keywords (lowercase)
        [
          /[a-z_][\w']*/,
          {
            cases: {
              "@keywords": "keyword",
              "@processOps": "keyword.control",
              "@default": "identifier",
            },
          },
        ],

        [/[()\[\]{}]/, "@brackets"],
        [
          /@symbols/,
          { cases: { "@operators": "operator", "@default": "" } },
        ],
        [/[,;.]/, "delimiter"],
      ],

      blockComment: [
        [/[^{-]+/, "comment"],
        [/-\}/, "comment", "@pop"],
        [/\{-/, "comment", "@push"],
        [/[{-]/, "comment"],
      ],

      string: [
        [/[^\\"]+/, "string"],
        [/@escapes/, "string.escape"],
        [/"/, "string", "@pop"],
      ],
    },
  });
}
