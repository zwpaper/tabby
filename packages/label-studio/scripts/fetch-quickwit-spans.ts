#!/usr/bin/env bun

import { parseArgs } from "node:util";

const QuickWitBaseUrl = "https://quickwit.jump.getpochi.com/";
const QuickWitIndexId = "otel-traces-v0_7";

// Default query contains
// - only successful attempts
// - only text generation
// - only gemini-2.5-pro
// - no image input
const DefaultQuery = [
  "span_attributes.ai.response.toolCalls:attemptCompletion",
  "span_attributes.ai.usage.promptTokens:[14000 TO 110000]",
  "span_name:ai.streamText.doStream",
  "span_attributes.ai.model.id:gemini-2.5-pro",
  `NOT span_attributes.ai.prompt.messages:'\{"type":"image"'`,
].join(" AND ");

interface QuickwitHit {
  span_id: string;
  span_start_timestamp_nanos?: string;
  span_attributes: {
    "ai.telemetry.metadata.task-id"?: string;
    [key: string]: unknown;
  };
}

interface QuickwitResponse {
  hits: QuickwitHit[];
  num_hits: number;
}

interface FetchOptions {
  username: string;
  password: string;
  startTime?: string;
  endTime?: string;
  maxHits?: number;
  query?: string;
  startOffset?: number;
  fetchAll?: boolean;
}

/**
 * Fetch spans from Quickwit API with time range and deduplicate by task-id
 */
export async function fetchQuickwitSpans({
  username,
  password,
  startTime,
  endTime,
  maxHits = 10000,
  query = DefaultQuery,
  startOffset = 0,
  fetchAll = false,
}: FetchOptions): Promise<string[]> {
  const auth = `Basic ${btoa(`${username}:${password}`)}`;

  console.log("\n⚡ Starting Quickwit span fetch...");
  console.log("📋 Query: attemptCompletion + high token usage (>14k)");

  // Convert nanosecond timestamps to seconds for API
  let startTimestampSeconds: string | undefined;
  let endTimestampSeconds: string | undefined;

  if (startTime) {
    startTimestampSeconds = Math.floor(
      Number.parseInt(startTime, 10) / 1_000_000_000,
    ).toString();
    const startDate = new Date(
      Number.parseInt(startTimestampSeconds, 10) * 1000,
    )
      .toISOString()
      .split("T")[0];
    console.log(`📅 Time range: ${startDate} to`);
  }
  if (endTime) {
    endTimestampSeconds = Math.floor(
      Number.parseInt(endTime, 10) / 1_000_000_000,
    ).toString();
    const endDate = new Date(Number.parseInt(endTimestampSeconds, 10) * 1000)
      .toISOString()
      .split("T")[0];
    console.log(`              ${endDate}`);
  }

  const taskIdToSpan = new Map<string, string>(); // Maps task ID to span ID
  let offset = startOffset;
  let totalProcessed = 0;
  let totalHits = 0;

  do {
    const urlBuilder = new URL(QuickWitBaseUrl);
    urlBuilder.pathname = `/api/v1/${QuickWitIndexId}/search`;
    urlBuilder.searchParams.append("query", query);
    urlBuilder.searchParams.append("sort_by", "+span_start_timestamp_nanos");
    urlBuilder.searchParams.append("max_hits", maxHits.toString());
    urlBuilder.searchParams.append("start_offset", offset.toString());
    urlBuilder.searchParams.append("format", "json");

    // Add timestamp filters
    if (startTimestampSeconds) {
      urlBuilder.searchParams.append("start_timestamp", startTimestampSeconds);
    }
    if (endTimestampSeconds) {
      urlBuilder.searchParams.append("end_timestamp", endTimestampSeconds);
    }

    const response = await fetch(urlBuilder.toString(), {
      headers: {
        Authorization: auth,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch spans: ${response.status} ${response.statusText}\nResponse: ${await response.text()}`,
      );
    }

    const data = (await response.json()) as QuickwitResponse;
    totalHits = data.num_hits;

    if (offset === 0) {
      console.log(`\n🔍 Found ${totalHits} total spans to process`);
    }
    if (totalHits > maxHits) {
      console.log(
        `📄 Fetching page ${Math.floor(offset / maxHits) + 1} (${data.hits.length} hits)...`,
      );
    }

    // Process hits and deduplicate by task-id
    for (const hit of data.hits) {
      const taskId = hit.span_attributes["ai.telemetry.metadata.task-id"];
      if (typeof taskId === "string" && taskId.trim()) {
        // Only keep the first span for each task-id (since sorted by timestamp)
        if (!taskIdToSpan.has(taskId)) {
          taskIdToSpan.set(taskId, hit.span_id);
        }
      }
    }

    totalProcessed += data.hits.length;
    offset += data.hits.length;

    if (fetchAll && totalHits > maxHits) {
      console.log(
        `   Progress: ${totalProcessed}/${totalHits} spans processed, ${taskIdToSpan.size} unique tasks found`,
      );
    }

    // Break if we've processed all available data or if fetchAll is false
    if (!fetchAll || data.hits.length === 0 || totalProcessed >= totalHits) {
      break;
    }

    // Add a small delay between requests to be respectful
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (fetchAll);

  const result = Array.from(taskIdToSpan.values());

  console.log("\n✨ Processing complete!");
  console.log(
    `📊 ${result.length} unique span IDs (deduplicated from ${totalProcessed} total spans)`,
  );

  return result;
}

/**
 * Convert date string to nanoseconds timestamp
 */
function dateToNanos(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  return (date.getTime() * 1_000_000).toString();
}

/**
 * Generate Quickwit UI search URL for validation
 */
function generateUISearchUrl(
  query: string,
  startTime?: string,
  endTime?: string,
): string {
  const baseUrl = "https://quickwit.jump.getpochi.com/ui/search";
  const params = new URLSearchParams();

  // Convert query from "AND" format to newline format for UI
  const uiQuery = query.split(" AND ").join("\n");

  params.append("query", uiQuery);
  params.append("index_id", QuickWitIndexId);
  params.append("max_hits", "100");
  params.append("sort_by_field", "+span_start_timestamp_nanos");

  // Add timestamp parameters if available
  if (startTime) {
    const startSeconds = Math.floor(
      Number.parseInt(startTime, 10) / 1_000_000_000,
    ).toString();
    params.append("start_timestamp", startSeconds);
  }
  if (endTime) {
    const endSeconds = Math.floor(
      Number.parseInt(endTime, 10) / 1_000_000_000,
    ).toString();
    params.append("end_timestamp", endSeconds);
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Main CLI function
 */
async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      username: {
        type: "string",
        short: "u",
        default: "ragdoll",
      },
      password: {
        type: "string",
        short: "p",
      },
      "start-time": {
        type: "string",
        short: "s",
        default: "2025-01-01T00:00:00Z",
      },
      "end-time": {
        type: "string",
        short: "e",
      },
      "max-hits": {
        type: "string",
        short: "m",
        default: "10000",
      },
      query: {
        type: "string",
        short: "q",
        default: DefaultQuery,
      },
      format: {
        type: "string",
        short: "f",
        default: "json",
      },
      "fetch-all": {
        type: "boolean",
        short: "a",
        default: true,
      },
      "output-file": {
        type: "string",
        short: "w",
      },
      "start-offset": {
        type: "string",
        short: "o",
        default: "0",
      },
      help: {
        type: "boolean",
        short: "h",
      },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
Usage: bun run scripts/fetch-quickwit-spans.ts [options]

Options:
  -u, --username <username>     Username for Quickwit API (default: "ragdoll")
  -p, --password <password>     Password for Quickwit API (required)
  -s, --start-time <datetime>   Start time (ISO format, default: "2025-01-01T00:00:00Z")
  -e, --end-time <datetime>     End time (ISO format, e.g., "2023-12-01T23:59:59Z")
  -m, --max-hits <number>       Maximum hits per page (default: 10000)
  -q, --query <query>           Base query string (default: attemptCompletion with high token usage)
  -f, --format <format>         Output format (json|csv|table) (default: json)
  -a, --fetch-all               Fetch all pages of data (default: true)
  -o, --start-offset <number>   Starting offset for pagination (default: 0)
  -w, --output-file <filename>  Output file (default: auto-generated filename)
  -h, --help                    Show this help message

Examples:
  # Basic usage (uses defaults: Aug 4th start, fetch all, save to file)
  bun run scripts/fetch-quickwit-spans.ts -p mypassword
  
  # Fetch spans for specific time range
  bun run scripts/fetch-quickwit-spans.ts -p mypassword -s "2024-07-01T00:00:00Z" -e "2024-08-04T23:59:59Z"
  
  # Output to specific file as CSV
  bun run scripts/fetch-quickwit-spans.ts -p mypassword -f csv -w spans.csv
  
  # Custom time range with specific output file
  bun run scripts/fetch-quickwit-spans.ts -p mypassword -s "2024-07-15T00:00:00Z" -w july-spans.json
`);
    process.exit(0);
  }

  if (!values.password) {
    console.error("Error: Password is required. Use -p or --password option.");
    process.exit(1);
  }

  try {
    const options: FetchOptions = {
      username: values.username ?? "ragdoll",
      password: values.password ?? "",
      maxHits: Number.parseInt(values["max-hits"] ?? "10000", 10),
      query: values.query ?? DefaultQuery,
      fetchAll: values["fetch-all"] ?? true,
      startOffset: Number.parseInt(values["start-offset"] ?? "0", 10),
    };

    // Convert date strings to nanosecond timestamps if provided
    if (values["start-time"]) {
      options.startTime = dateToNanos(values["start-time"]);
    }
    if (values["end-time"]) {
      options.endTime = dateToNanos(values["end-time"]);
    }

    // Generate UI search URL for validation
    const uiSearchUrl = generateUISearchUrl(
      options.query ?? DefaultQuery,
      options.startTime,
      options.endTime,
    );

    console.log("\n🔗 UI Validation Link:");
    console.log(`   ${uiSearchUrl}\n`);

    const spans = await fetchQuickwitSpans(options);

    // Generate output content - spans is now array of span IDs
    let outputContent: string;
    switch (values.format) {
      case "csv": {
        const csvLines = ["span_id"];
        for (const spanId of spans) {
          csvLines.push(spanId);
        }
        outputContent = csvLines.join("\n");
        break;
      }
      case "table":
        console.table(spans.map((id) => ({ span_id: id })));
        outputContent = JSON.stringify(spans, null, 2); // fallback for file output
        break;
      default:
        outputContent = JSON.stringify(spans, null, 2);
        break;
    }

    // Handle output - file or console
    const outputFile = values["output-file"];
    if (outputFile) {
      const fs = await import("node:fs/promises");
      await fs.writeFile(outputFile, outputContent, "utf8");
      console.log(`\n💾 Results saved to: ${outputFile}`);
      console.log(`🎯 Final count: ${spans.length} unique span IDs\n`);
    } else {
      // Default file output if no specific file specified
      const defaultFilename = `quickwit-spans-${new Date().toISOString().slice(0, 10)}.json`;
      const fs = await import("node:fs/promises");
      await fs.writeFile(defaultFilename, outputContent, "utf8");
      console.log(`\n💾 Results saved to: ${defaultFilename}`);
      console.log(`🎯 Final count: ${spans.length} unique span IDs`);

      // Also output to console for immediate viewing
      if (values.format !== "table") {
        console.log("\n📋 Preview (first 5):");
        const preview = spans.slice(0, 5);
        preview.forEach((id, i) => console.log(`   ${i + 1}. ${id}`));
        if (spans.length > 5) {
          console.log(`   ... and ${spans.length - 5} more\n`);
        } else {
          console.log("");
        }
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
