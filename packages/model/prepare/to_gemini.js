import { readFileSync } from "node:fs";

const data = readFileSync("./data/label.jsonl", "utf-8").split("\n");

for (const line of data) {
  const json = JSON.parse(line);
  if (json.excuded) continue;
  if (!json.verified) continue;

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
  console.log(JSON.stringify(geminiData));
}
