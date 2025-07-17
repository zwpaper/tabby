import * as levenshtein from "fast-levenshtein";

// Keywords appear in the code everywhere, but we don't want to use them for
// matching in code searching.
// Just filter them out before we start using a syntax parser.
const reservedKeywords = [
  // Typescript: https://github.com/microsoft/TypeScript/issues/2536
  "as",
  "any",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "constructor",
  "continue",
  "debugger",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "get",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "module",
  "new",
  "null",
  "number",
  "of",
  "package",
  "private",
  "protected",
  "public",
  "require",
  "return",
  "set",
  "static",
  "string",
  "super",
  "switch",
  "symbol",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
];

export function extractNonReservedWordList(text: string): string {
  const re = /\w+/g;
  return [
    ...new Set(
      text
        .match(re)
        ?.filter(
          (symbol) => symbol.length > 2 && !reservedKeywords.includes(symbol),
        ),
    ).values(),
  ].join(" ");
}

export function splitLines(input: string) {
  const lines = input.match(/.*(?:$|\r?\n)/g)?.filter(Boolean) ?? []; // Split lines and keep newline character
  if (lines.length > 0 && lines[lines.length - 1]?.endsWith("\n")) {
    // Keep last empty line
    lines.push("");
  }
  return lines;
}

export function isBlank(input: string) {
  return input.trim().length === 0;
}

// Indentation

export function getIndentationLevel(line: string, indentation?: string) {
  if (indentation === undefined) {
    return line.match(/^[ \t]*/)?.[0]?.length ?? 0;
  }
  if (indentation === "\t") {
    return line.match(/^\t*/)?.[0].length ?? 0;
  }
  if (indentation.match(/^ *$/)) {
    const spaces = line.match(/^ */)?.[0].length ?? 0;
    return spaces / indentation.length;
  }
  throw new Error(`Invalid indentation: ${indentation}`);
}

// function foo(a) {  // <-- block opening line
//   return a;
// }                  // <-- block closing line
export function isBlockOpeningLine(lines: string[], index: number): boolean {
  if (index < 0 || index >= lines.length - 1) {
    return false;
  }
  return (
    getIndentationLevel(lines[index]) < getIndentationLevel(lines[index + 1])
  );
}

export function isBlockClosingLine(lines: string[], index: number): boolean {
  if (index <= 0 || index > lines.length - 1) {
    return false;
  }
  return (
    getIndentationLevel(lines[index - 1]) > getIndentationLevel(lines[index])
  );
}

// Using string levenshtein distance is not good, because variable name may create a large distance.
// Such as distance is 9 between `const fooFooFoo = 1;` and `const barBarBar = 1;`, but maybe 1 is enough.
// May be better to count distance based on words instead of characters.
export function calcDistance(a: string, b: string) {
  return levenshtein.get(a, b);
}

/**
 * Crop the text to fit within the specified character limit.
 * If the text is cropped, it ensures the last line is complete by trimming at the last newline.
 *
 * @param text The input text to crop.
 * @param maxChars The maximum number of characters allowed.
 * @returns The cropped text.
 */
export function cropTextToMaxChars(text: string, maxChars: number): string {
  let croppedText = text;
  if (croppedText.length > maxChars) {
    croppedText = croppedText.slice(0, maxChars);
    const lastNewLine = croppedText.lastIndexOf("\n");
    if (lastNewLine > 0) {
      croppedText = croppedText.slice(0, lastNewLine + 1);
    }
  }
  return croppedText;
}
