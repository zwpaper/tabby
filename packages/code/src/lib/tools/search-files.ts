import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { SearchFilesFunctionType } from "@ragdoll/tools";
import type { AbortableFunctionType } from "./types";

const execAsync = promisify(exec);

// Define an interface for the relevant parts of the rg JSON output
interface RipgrepMatchData {
  path: { text: string };
  lines: { text: string }; // The matched line content (including newline)
  line_number: number;
}

// Add interfaces for other ripgrep JSON output types
interface RipgrepPathData {
  path: { text: string };
}

interface RipgrepContextData extends RipgrepPathData {
  lines: { text: string };
  line_number: number;
}

interface RipgrepStats {
  elapsed_total: { secs: number; nanos: number; human: string };
  searches: number;
  searches_with_match: number;
  bytes_searched: number;
  bytes_printed: number;
  matched_lines: number;
  matches: number;
}

interface RipgrepEndData extends RipgrepPathData {
  binary_offset: number | null;
  stats: RipgrepStats;
}

interface RipgrepSummaryData {
  elapsed_total: { secs: number; nanos: number; human: string };
  stats: RipgrepStats;
}

interface RipgrepOutput {
  type: "match" | "begin" | "end" | "summary" | "context";
  data:
    | RipgrepMatchData
    | RipgrepPathData
    | RipgrepContextData
    | RipgrepEndData
    | RipgrepSummaryData;
}

// Define a type for the error caught from execAsync
interface ExecError extends Error {
  code?: number;
  stdout?: string;
  stderr?: string;
}

export const searchFiles: AbortableFunctionType<
  SearchFilesFunctionType
> = async ({ path, regex, filePattern }, signal) => {
  const matches: { file: string; line: number; context: string }[] = [];

  // Construct the rg command
  // Use single quotes to wrap regex and path to handle potential spaces or special characters
  // Escape single quotes within the regex itself if necessary (though rg might handle this)
  // Using --multiline to ensure regex can span multiple lines if needed, though the output format focuses on single line matches
  // Using --fixed-strings might be safer if the input 'regex' isn't meant to be a regex, but the param name suggests it is.
  // Added --case-sensitive based on original implementation's RegExp usage (default is case-sensitive)
  // Added --binary to skip binary files, similar to the original file-type check
  let command = "rg --json --case-sensitive --binary ";

  if (filePattern) {
    // Add glob pattern. Ensure it's properly quoted.
    command += `--glob '${filePattern.replace(/'/g, "'''")}' `; // Escape single quotes in pattern
  }

  // Add regex and path. Ensure they are properly quoted.
  command += `'${regex.replace(/'/g, "'''")}' '${path.replace(/'/g, "'''")}'`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      // Set a reasonable maxBuffer size in case of large output
      // Consider streaming if output can be extremely large
      maxBuffer: 1024 * 1024 * 10, // 10MB
      signal, // Pass the abort signal
    });

    if (stderr) {
      console.warn(`rg command stderr: ${stderr}`);
      // Decide if stderr should be treated as an error or just a warning
      // For now, we'll proceed but log it. Some rg warnings might not be fatal.
    }

    // rg --json outputs newline-separated JSON objects
    const outputLines = stdout.trim().split("\n");

    for (const line of outputLines) {
      try {
        const output = JSON.parse(line) as RipgrepOutput;

        if (output.type === "match") {
          const matchData = output.data as RipgrepMatchData;
          matches.push({
            file: matchData.path.text,
            line: matchData.line_number,
            // rg includes the newline in lines.text, trim it
            context: matchData.lines.text.replace(/\r?\n$/, ""),
          });
        }
      } catch (parseError) {
        console.error(
          `Failed to parse rg JSON output line: ${line}`,
          parseError,
        );
        // Continue processing other lines
      }
    }
    // biome-ignore lint/suspicious/noExplicitAny: exception catch has to be any
  } catch (error: any) {
    if (!(error satisfies ExecError)) {
      throw error;
    }

    // Handle errors, e.g., rg not found, command execution failure
    // error.code === 1 often means rg found matches but encountered non-fatal errors (like permission denied on a dir)
    // error.code > 1 usually indicates a more serious issue.
    // rg exits with 0 if matches are found, 1 if no matches are found, >1 for errors.
    // The original function returns empty matches if none found, so exit code 1 is not an error here.
    if (error.code && error.code > 1) {
      // Rethrow or handle more specific errors if needed
      // Include stderr in the error message for better debugging
      throw new Error(
        `rg command failed with code ${error.code}: ${error.stderr || error.message}`,
      );
    }
    if (!error.code && error.stderr) {
      // Log stderr even if code is 0 (e.g., warnings)
      console.warn(`rg command stderr (exit code 0): ${error.stderr}`);
    } else if (error.code === 1 && !error.stdout && !error.stderr) {
      // Exit code 1 and no output means no matches found, which is not an error for this function.
      // console.log("rg command finished with exit code 1 (no matches found).");
    } else if (error.code === 1 && error.stdout) {
      // Exit code 1 but there was output (matches were found, but maybe some errors occurred)
      // We already processed stdout, so just log stderr if present
      if (error.stderr) {
        console.warn(`rg command stderr (exit code 1): ${error.stderr}`);
      }
    } else if (!error.code && !error.stdout && !error.stderr) {
      // Exit code 0, no output - could happen if search path is empty or matches no files
      // console.log("rg command finished with exit code 0 (no matches found or no files searched).");
    } else {
      // Other unexpected errors
      console.error("Error executing rg command:", error);
      throw error; // Rethrow unexpected errors
    }
    // If error.code is 1 (no matches), we fall through and return the empty matches array, which is correct.
  }

  return { matches };
};
