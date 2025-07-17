import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import type { GeminiData, Message, TaskData } from "../src/types";

const data = readFileSync("./data/label.jsonl", "utf-8").split("\n");

const trainFilePath = "./data/train.jsonl";
const validationFilePath = "./data/validation.jsonl";

if (!existsSync("./data")) {
  mkdirSync("./data");
}
writeFileSync(trainFilePath, ""); // Clear the file if it exists
writeFileSync(validationFilePath, ""); // Clear the file if it exists

function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

let numExcluded = 0;
let numNotVerified = 0;
let numTrain = 0;
let numValidation = 0;

for (const line of data) {
  const json: TaskData = JSON.parse(line);
  if (json.excluded) {
    numExcluded++;
  }
  if (!json.verified) {
    numNotVerified++;
  }
  if (json.excluded || !json.verified) {
    continue;
  }

  const geminiData: GeminiData = {
    systemInstruction: {
      role: "system",
      parts: [],
    },
    contents: [],
  };

  // First we merge roles of same into a single message
  // Then we convert to gemini format
  const messages: Message[] = [];
  for (let i = 0; i < json.messages.length; i++) {
    const x = json.messages[i];
    if (x.isDeleted) continue;
    x.content = x.content.filter((x) => !x.isDeleted);
    if (x.content.length === 0) continue;
    messages.push(x);
  }

  // Merge messages of consecutive same roles
  for (let i = 0; i < messages.length; i++) {
    const x = messages[i];
    if (i > 0 && x.role === messages[i - 1].role) {
      messages[i - 1].content.push(...x.content);
      messages.splice(i, 1);
      i--;
    }
  }

  for (const x of messages) {
    const text = x.content
      .map((x) => x.newText || x.text)
      .map((x) => x.trim())
      .join("\n");
    if (text.length === 0) {
      throw new Error("Empty message");
    }

    if (x.role === "system") {
      geminiData.systemInstruction.parts.push({
        text,
      });
      continue;
    }

    geminiData.contents.push({
      role: x.role === "user" ? "user" : "model",
      parts: [
        {
          text,
        },
      ],
    });
  }

  const isTrain = Math.abs(hashString(json.uid)) % 10 !== 0; // 90% train, 10% validation
  if (isTrain) {
    numTrain++;
  } else {
    numValidation++;
  }
  const outputFilePath = isTrain ? trainFilePath : validationFilePath;
  appendFileSync(outputFilePath, `${JSON.stringify(geminiData)}\n`);
}

console.log(
  `Total: ${data.length} Excluded: ${numExcluded} Not Verified: ${numNotVerified}`,
);

console.log(`Train: ${numTrain}, Validation: ${numValidation}`);
