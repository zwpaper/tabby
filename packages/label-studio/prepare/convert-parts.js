import { readFileSync, writeFileSync } from "node:fs";
import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";

/**
 * Convert content from string to Part array format
 * @param {string|Array} content - Original content
 * @returns {Array} Converted Part array
 */
function convertContentToParts(content) {
  // If already array format, return as is
  if (Array.isArray(content)) {
    return content;
  }

  // If string, convert to structured array
  if (typeof content === "string") {
    return [
      {
        type: "text",
        text: content,
      },
    ];
  }

  // Other cases, return empty array
  return [];
}

/**
 * Convert single task data
 * @param {Object} taskData - Task data object
 * @returns {Object} Converted task data
 */
function convertTask(taskData) {
  const convertedTask = { ...taskData };

  if (convertedTask.messages?.length) {
    convertedTask.messages = convertedTask.messages.map((message) => ({
      ...message,
      content: convertContentToParts(message.content),
    }));
  }

  return convertedTask;
}

/**
 * Process JSONL file, read and convert line by line
 * @param {string} inputPath - Input file path
 * @param {string} outputPath - Output file path
 */
async function convertJsonlFile(inputPath, outputPath) {
  const fileStream = createReadStream(inputPath);
  const writeStream = createWriteStream(outputPath);

  const rl = createInterface({
    input: fileStream,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  let lineCount = 0;
  let convertedCount = 0;

  console.log(`Starting conversion of file: ${inputPath}`);

  for await (const line of rl) {
    lineCount++;

    if (line.trim() === "") {
      continue;
    }

    try {
      const taskData = JSON.parse(line);
      const convertedTask = convertTask(taskData);

      // Check if conversion occurred
      let hasStringContent = false;
      if (taskData.messages) {
        for (const message of taskData.messages) {
          if (typeof message.content === "string") {
            hasStringContent = true;
            break;
          }
        }
      }

      if (hasStringContent) {
        convertedCount++;
        console.log(
          `Converting task ${taskData.uid || "unknown"} (line ${lineCount})`,
        );
      }

      writeStream.write(`${JSON.stringify(convertedTask)}\n`);
    } catch (error) {
      console.error(`Error parsing line ${lineCount}:`, error.message);
      console.error(`Problem line content: ${line.substring(0, 100)}...`);
    }
  }

  writeStream.end();

  console.log("Conversion completed!");
  console.log(`- Total lines: ${lineCount}`);
  console.log(`- Converted tasks: ${convertedCount}`);
  console.log(`- Output file: ${outputPath}`);
}

/**
 * Process JSON file
 * @param {string} inputPath - Input file path
 * @param {string} outputPath - Output file path
 */
function convertJsonFile(inputPath, outputPath) {
  console.log(`Starting conversion of JSON file: ${inputPath}`);

  try {
    const data = JSON.parse(readFileSync(inputPath, "utf8"));
    let convertedCount = 0;

    if (Array.isArray(data)) {
      // Process array format
      const convertedData = data.map((taskData) => {
        const hasStringContent = taskData.messages?.some(
          (msg) => typeof msg.content === "string",
        );

        if (hasStringContent) {
          convertedCount++;
          console.log(`Converting task ${taskData.uid || "unknown"}`);
        }

        return convertTask(taskData);
      });

      writeFileSync(outputPath, JSON.stringify(convertedData, null, 2));
    } else {
      // Process single object
      const convertedTask = convertTask(data);
      writeFileSync(outputPath, JSON.stringify(convertedTask, null, 2));
      if (data.messages?.some((msg) => typeof msg.content === "string")) {
        convertedCount = 1;
      }
    }

    console.log("JSON conversion completed!");
    console.log(`- Converted tasks: ${convertedCount}`);
    console.log(`- Output file: ${outputPath}`);
  } catch (error) {
    console.error("Error processing JSON file:", error.message);
  }
}

// Main function
function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log("Usage:");
    console.log("  node convert-parts.js <input-file> [output-file]");
    console.log("");
    console.log("Examples:");
    console.log("  node convert-parts.js label.jsonl label-converted.jsonl");
    console.log("  node convert-parts.js data.json data-converted.json");
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1] || inputPath.replace(/(\.[^.]+)$/, "-converted$1");

  console.log(`Input file: ${inputPath}`);
  console.log(`Output file: ${outputPath}`);
  console.log("");

  if (inputPath.endsWith(".jsonl")) {
    convertJsonlFile(inputPath, outputPath);
  } else if (inputPath.endsWith(".json")) {
    convertJsonFile(inputPath, outputPath);
  } else {
    console.error("Unsupported file format. Please use .json or .jsonl files.");
    process.exit(1);
  }
}

// If running this script directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  convertContentToParts,
  convertTask,
  convertJsonlFile,
  convertJsonFile,
};
