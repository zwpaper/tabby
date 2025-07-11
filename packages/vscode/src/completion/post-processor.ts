import * as vscode from "vscode";
import type {
  CompletionContext,
  CompletionResultItem,
  PostProcessFilter,
} from "./types";

export class PostProcessor {
  private preProcessors: PostProcessFilter[] = [
    new TrimMultiLineInSingleLineMode(),
    new RemoveLineEndsWithRepetition(),
    new DropDuplicated(),
    new TrimSpace(),
    new DropMinimum(),
  ];

  private postProcessors: PostProcessFilter[] = [
    new RemoveRepetitiveBlocks(),
    new RemoveRepetitiveLines(),
    new LimitScope(),
    new RemoveDuplicatedBlockClosingLine(),
    new FormatIndentation(),
    new NormalizeIndentation(),
    new DropDuplicated(),
    new TrimSpace(),
    new RemoveDuplicateSuffixLines(),
    new DropMinimum(),
  ];

  process(
    choices: Array<{ index: number; text: string }>,
    context: CompletionContext,
    phase: "pre" | "post" = "post",
  ): CompletionResultItem[] {
    const processors =
      phase === "pre" ? this.preProcessors : this.postProcessors;

    return choices
      .map((choice) => {
        let item: CompletionResultItem = {
          text: choice.text,
          range: this.calculateRange(context),
        };

        for (const processor of processors) {
          item = processor.process(item, context);
          if (item.text === "") {
            break; // Empty completion, skip further processing
          }
        }

        return item;
      })
      .filter((item) => item.text !== "");
  }

  private calculateRange(context: CompletionContext): vscode.Range {
    const start = context.position;
    if (context.isLineEnd && context.lineEndReplaceLength > 0) {
      // Replace whitespace at line end
      const end = context.position.translate(0, context.lineEndReplaceLength);
      return new vscode.Range(start, end);
    }
    return new vscode.Range(start, start);
  }
}

// Individual post-processors

class TrimMultiLineInSingleLineMode implements PostProcessFilter {
  process(
    item: CompletionResultItem,
    context: CompletionContext,
  ): CompletionResultItem {
    // If we're in a single-line context, trim to first line only
    if (context.isLineEnd && !context.suffix.includes("\n")) {
      const firstLine = item.text.split("\n")[0];
      return { ...item, text: firstLine };
    }
    return item;
  }
}

class RemoveLineEndsWithRepetition implements PostProcessFilter {
  private repetitionTests = [
    /(.{3,}?)\1{5,}$/g, // 3+ chars repeated 5+ times at line end
    /(.{10,}?)\1{3,}$/g, // 10+ chars repeated 3+ times at line end
  ];

  process(
    item: CompletionResultItem,
    _context: CompletionContext,
  ): CompletionResultItem {
    const lines = item.text.split("\n");
    if (lines.length === 0) return item;

    // Check the last non-blank line for repetition
    let lastLineIndex = lines.length - 1;
    while (lastLineIndex >= 0 && this.isBlank(lines[lastLineIndex])) {
      lastLineIndex--;
    }

    if (lastLineIndex < 0) return item;

    const lastLine = lines[lastLineIndex];
    for (const test of this.repetitionTests) {
      if (test.test(lastLine)) {
        // Remove the problematic line
        if (lines.length === 1) {
          return { ...item, text: "" };
        }
        lines.splice(lastLineIndex, 1);
        return { ...item, text: lines.join("\n") };
      }
    }

    return item;
  }

  private isBlank(line: string): boolean {
    return /^\s*$/.test(line);
  }
}

class DropDuplicated implements PostProcessFilter {
  process(
    item: CompletionResultItem,
    context: CompletionContext,
  ): CompletionResultItem {
    const inputLines = item.text.split("\n");
    const suffixLines = context.suffixLines;

    // Skip blank lines, compare first 3 lines
    const lineCount = Math.min(3, inputLines.length, suffixLines.length);

    let inputIndex = 0;
    let suffixIndex = 0;

    // Skip blank lines
    while (
      inputIndex < inputLines.length &&
      this.isBlank(inputLines[inputIndex])
    ) {
      inputIndex++;
    }
    while (
      suffixIndex < suffixLines.length &&
      this.isBlank(suffixLines[suffixIndex])
    ) {
      suffixIndex++;
    }

    if (inputIndex >= inputLines.length || suffixIndex >= suffixLines.length) {
      return item;
    }

    const inputToCompare = inputLines
      .slice(inputIndex, inputIndex + lineCount)
      .join("")
      .trim();
    const suffixToCompare = suffixLines
      .slice(suffixIndex, suffixIndex + lineCount)
      .join("")
      .trim();

    // Dynamic threshold: minimum 1 character or 5% of string length
    const threshold = Math.max(
      1,
      0.05 * inputToCompare.length,
      0.05 * suffixToCompare.length,
    );

    const distance = this.calculateLevenshteinDistance(
      inputToCompare,
      suffixToCompare,
    );

    if (distance <= threshold) {
      return { ...item, text: "" }; // Return empty completion
    }

    return item;
  }

  private isBlank(line: string): boolean {
    return /^\s*$/.test(line);
  }

  private calculateLevenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1)
      .fill(null)
      .map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }

    return matrix[b.length][a.length];
  }
}

class TrimSpace implements PostProcessFilter {
  process(
    item: CompletionResultItem,
    context: CompletionContext,
  ): CompletionResultItem {
    let trimmedText = item.text;

    // Trim start if prefix ends with whitespace
    if (
      !this.isBlank(context.currentLinePrefix) &&
      context.currentLinePrefix.match(/\s$/)
    ) {
      trimmedText = trimmedText.trimStart();
    }

    // Trim end if suffix is blank or starts with whitespace
    if (
      this.isBlank(context.currentLineSuffix) ||
      context.currentLineSuffix.match(/^\s/)
    ) {
      trimmedText = trimmedText.trimEnd();
    }

    return trimmedText !== item.text ? { ...item, text: trimmedText } : item;
  }

  private isBlank(text: string): boolean {
    return /^\s*$/.test(text);
  }
}

class DropMinimum implements PostProcessFilter {
  process(
    item: CompletionResultItem,
    _context: CompletionContext,
  ): CompletionResultItem {
    // Drop completions that are too short to be useful
    const trimmed = item.text.trim();
    if (trimmed.length < 2) {
      return { ...item, text: "" };
    }
    return item;
  }
}

class RemoveRepetitiveBlocks implements PostProcessFilter {
  process(
    item: CompletionResultItem,
    _context: CompletionContext,
  ): CompletionResultItem {
    const blocks = item.text.split(/\n\s*\n/); // Split on blank lines
    if (blocks.length < 3) return item;

    let repetitionCount = 0;
    const repetitionThreshold = 2;

    // Compare consecutive blocks backwards
    let index = blocks.length - 2;
    while (index >= 1) {
      const currentBlock = blocks[index].trim();
      const previousBlock = blocks[index - 1].trim();

      if (currentBlock.length === 0 || previousBlock.length === 0) {
        index--;
        continue;
      }

      const threshold = Math.max(
        0.1 * currentBlock.length,
        0.1 * previousBlock.length,
      );
      const distance = this.calculateDistance(currentBlock, previousBlock);

      if (distance <= threshold) {
        repetitionCount++;
        index--;
      } else {
        break;
      }
    }

    if (repetitionCount >= repetitionThreshold) {
      const trimmedBlocks = blocks.slice(0, index + 1);
      return { ...item, text: trimmedBlocks.join("\n\n").trimEnd() };
    }

    return item;
  }

  private calculateDistance(a: string, b: string): number {
    // Simplified distance calculation
    if (a === b) return 0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 0;

    let matches = 0;
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      if (a[i] === b[i]) matches++;
    }

    return maxLen - matches;
  }
}

class RemoveRepetitiveLines implements PostProcessFilter {
  process(
    item: CompletionResultItem,
    _context: CompletionContext,
  ): CompletionResultItem {
    const lines = item.text.split("\n");
    if (lines.length < 6) return item;

    let repetitionCount = 0;
    const repetitionThreshold = 5;

    // Compare consecutive lines backwards
    let index = lines.length - 1;
    while (index >= 1) {
      const currentLine = lines[index].trim();
      const previousLine = lines[index - 1].trim();

      if (currentLine.length === 0 || previousLine.length === 0) {
        index--;
        continue;
      }

      const threshold = Math.max(
        0.1 * currentLine.length,
        0.1 * previousLine.length,
      );
      const distance = this.calculateDistance(currentLine, previousLine);

      if (distance <= threshold) {
        repetitionCount++;
        index--;
      } else {
        break;
      }
    }

    if (repetitionCount >= repetitionThreshold) {
      const trimmedLines = lines.slice(0, index + 1);
      return { ...item, text: trimmedLines.join("\n").trimEnd() };
    }

    return item;
  }

  private calculateDistance(a: string, b: string): number {
    // Same as RemoveRepetitiveBlocks
    if (a === b) return 0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 0;

    let matches = 0;
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      if (a[i] === b[i]) matches++;
    }

    return maxLen - matches;
  }
}

class LimitScope implements PostProcessFilter {
  process(
    item: CompletionResultItem,
    context: CompletionContext,
  ): CompletionResultItem {
    const indentationContext = this.parseIndentationContext(context);

    const lines = item.text.split("\n");
    let cutIndex = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indentLevel = this.getIndentationLevel(line);

      if (indentLevel > indentationContext.indentLevelLimit) {
        cutIndex = i;
        break;
      }

      if (this.isClosingLine(line) && !indentationContext.allowClosingLine) {
        cutIndex = i;
        break;
      }
    }

    if (cutIndex < lines.length) {
      const trimmedText = lines.slice(0, cutIndex).join("\n").trimEnd();
      return { ...item, text: trimmedText };
    }

    return item;
  }

  private parseIndentationContext(context: CompletionContext) {
    const prefixLines = context.prefixLines;

    // Find reference line in prefix (skip blank lines)
    let referenceLineIndex = prefixLines.length - 1;
    while (
      referenceLineIndex >= 0 &&
      this.isBlank(prefixLines[referenceLineIndex])
    ) {
      referenceLineIndex--;
    }

    if (referenceLineIndex < 0) {
      return { indentLevelLimit: 0, allowClosingLine: true };
    }

    const referenceLine = prefixLines[referenceLineIndex];
    const referenceIndent = this.getIndentationLevel(referenceLine);

    // Determine indent limit based on context
    const result = {
      indentLevelLimit: referenceIndent,
      allowClosingLine: true,
    };

    if (this.isBlockOpeningLine(referenceLine)) {
      result.indentLevelLimit = referenceIndent + 1;
    }

    return result;
  }

  private getIndentationLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;

    const indent = match[1];
    // Count tabs as 4 spaces
    return indent.replace(/\t/g, "    ").length / 4;
  }

  private isBlank(line: string): boolean {
    return /^\s*$/.test(line);
  }

  private isBlockOpeningLine(line: string): boolean {
    // Simple heuristic for block opening lines
    return /[{:\(]\s*$/.test(line.trim());
  }

  private isClosingLine(line: string): boolean {
    // Simple heuristic for closing lines
    return /^\s*[}\)\]]\s*$/.test(line);
  }
}

class RemoveDuplicatedBlockClosingLine implements PostProcessFilter {
  process(
    item: CompletionResultItem,
    context: CompletionContext,
  ): CompletionResultItem {
    const lines = item.text.split("\n");
    if (lines.length === 0) return item;

    const lastLine = lines[lines.length - 1];
    if (!this.isClosingLine(lastLine)) return item;

    // Check if suffix starts with a similar closing line
    const suffixFirstLine = context.suffixLines[0] || "";
    if (this.isClosingLine(suffixFirstLine)) {
      // Remove the duplicate closing line
      lines.pop();
      return { ...item, text: lines.join("\n") };
    }

    return item;
  }

  private isClosingLine(line: string): boolean {
    return /^\s*[}\)\]]\s*$/.test(line);
  }
}

class FormatIndentation implements PostProcessFilter {
  process(
    item: CompletionResultItem,
    context: CompletionContext,
  ): CompletionResultItem {
    const contextIndent = this.detectIndentation(context.prefixLines);
    const completionIndent = this.detectIndentation(item.text.split("\n"));

    // Only format if context lacks indentation but completion has inconsistent style
    if (!contextIndent && completionIndent) {
      const formattedText = this.formatWithIndentation(
        item.text,
        contextIndent || "    ",
      );
      return { ...item, text: formattedText };
    }

    return item;
  }

  private detectIndentation(lines: string[]): string | null {
    const matches = { "\t": 0, "  ": 0, "    ": 0 };

    for (const line of lines) {
      if (line.match(/^\t/)) {
        matches["\t"]++;
      } else {
        const spaces = line.match(/^ */)?.[0].length ?? 0;
        if (spaces > 0) {
          if (spaces % 4 === 0) matches["    "]++;
          if (spaces % 2 === 0) matches["  "]++;
        }
      }
    }

    // Priority: tabs > 2-spaces > 4-spaces
    if (matches["\t"] > 0) return "\t";
    if (matches["  "] > matches["    "]) return "  ";
    if (matches["    "] > 0) return "    ";
    return null;
  }

  private formatWithIndentation(text: string, _indentStyle: string): string {
    // This is a simplified implementation
    // In practice, you'd want more sophisticated indentation formatting
    return text;
  }
}

class NormalizeIndentation implements PostProcessFilter {
  process(
    item: CompletionResultItem,
    _context: CompletionContext,
  ): CompletionResultItem {
    // Normalize mixed indentation (tabs and spaces)
    const lines = item.text.split("\n");
    const normalizedLines = lines.map((line) => {
      // Convert tabs to 4 spaces for consistency
      return line.replace(/\t/g, "    ");
    });

    return { ...item, text: normalizedLines.join("\n") };
  }
}

class RemoveDuplicateSuffixLines implements PostProcessFilter {
  process(
    item: CompletionResultItem,
    context: CompletionContext,
  ): CompletionResultItem {
    const completionLines = item.text.split("\n");
    const suffixLines = context.suffixLines;

    if (completionLines.length === 0 || suffixLines.length === 0) {
      return item;
    }

    // Check if completion ends with lines that are duplicated in suffix
    let removeCount = 0;
    const maxCheck = Math.min(completionLines.length, suffixLines.length, 3);

    for (let i = 0; i < maxCheck; i++) {
      const completionLine =
        completionLines[completionLines.length - 1 - i].trim();
      const suffixLine = suffixLines[i].trim();

      if (completionLine === suffixLine && completionLine.length > 0) {
        removeCount++;
      } else {
        break;
      }
    }

    if (removeCount > 0) {
      const trimmedLines = completionLines.slice(0, -removeCount);
      return { ...item, text: trimmedLines.join("\n") };
    }

    return item;
  }
}
