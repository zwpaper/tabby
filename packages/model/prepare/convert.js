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

for (const x of data) {
  for (const m of x.messages) {
    if (Array.isArray(m.content)) {
      m.content = m.content.filter((x) => x.type === "text");
    }
  }
}

// Sort data by length of x.messages
data.sort((a, b) => b.messages.length - a.messages.length);

// Dedupe data by x.uid
const seen = new Set();
const deduped = [];
for (const x of data) {
  if (!seen.has(x.uid)) {
    console.log("Adding", x.uid);
    seen.add(x.uid);
    deduped.push(x);
  } else {
    console.log("Duplicate:", x.uid);
  }
}

writeFileSync("./data/output.json", JSON.stringify(deduped, null, 2));
