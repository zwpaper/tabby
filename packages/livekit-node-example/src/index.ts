import * as readline from "node:readline/promises";
import { makeAdapter } from "@livestore/adapter-node";
import { type LiveStoreSchema, createStorePromise } from "@livestore/livestore";
import { LiveChatKit, catalog } from "@ragdoll/livekit";
import { Chat } from "./chat.node";

const adapter = makeAdapter({
  storage: { type: "fs", baseDirectory: "./data" },
});

const store = await createStorePromise<LiveStoreSchema>({
  adapter,
  schema: catalog.schema,
  storeId: "default",
});

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  const { chat } = new LiveChatKit(store, "default", Chat);

  while (true) {
    const userInput = await terminal.question("You: ");
    await chat.sendMessage({ text: userInput });
    const lastMessage = chat.lastMessage;
    if (!lastMessage) continue;
    for (const part of lastMessage.parts) {
      if (part.type === "text") {
        console.log("AI: ", part.text);
      }
    }
  }
}

main().catch(console.error);
