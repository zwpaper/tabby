import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync("./data/input.json"));

for (const x of data) {
  const parts = [];
  if (x.text) {
    parts.push({
      type: "text",
      text: x.text,
    });
  }

  for (const t of x.tool_calls) {
    parts.push({
      type: "text",
      text: `<api-request name="${t.toolName}">${JSON.stringify(t.args)}</api-request>`,
    });
  }

  x.messages.push({
    role: "assistant",
    content: parts,
  });

  x.text = undefined;
  x.tool_calls = undefined;
  x.email = undefined;
}

writeFileSync("./data/output.json", JSON.stringify(data, null, 2));
