import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

const data = readFileSync("./data/label.jsonl", "utf-8").split("\n");

const trainFilePath = "./data/train.jsonl";
const validationFilePath = "./data/validation.jsonl";

if (!existsSync("./data")) {
  mkdirSync("./data");
}
writeFileSync(trainFilePath, ""); // Clear the file if it exists
writeFileSync(validationFilePath, ""); // Clear the file if it exists

function hashString(str) {
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
  const json = JSON.parse(line);
  if (json.excluded) {
    numExcluded++;
  }
  if (!json.verified) {
    numNotVerified++;
  }
  if (json.excuded || !json.verified) {
    continue;
  }

  const geminiData = {
    systemInstruction: {
      role: "system",
      parts: [],
    },
    contents: [],
  };

  // First we merge roles of same into a single message
  // Then we convert to gemini format
  const messages = [];
  for (let i = 0; i < json.messages.length; i++) {
    const x = json.messages[i];
    if (x.role === "system") {
      messages.push(x);
      continue;
    }

    const lastMessage = messages.at(-1);
    if (!lastMessage) {
      messages.push(x);
      continue;
    }

    if (lastMessage.role === x.role) {
      lastMessage.content.push(...x.content);
    } else {
      messages.push(x);
    }
  }

  for (const x of messages) {
    if (x.role === "system") {
      geminiData.systemInstruction.parts.push({
        text: x.content,
      });
    } else {
      const text = x.content.map((x) => x.text.trim()).join("\n");
      geminiData.contents.push({
        role: x.role === "user" ? "user" : "model",
        parts: [
          {
            text,
          },
        ],
      });
    }
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
