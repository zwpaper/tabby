import { formatters, prompts } from "@ragdoll/common";
import { type CoreMessage, generateText } from "ai";
import type { UIMessage } from "ai";
import { geminiFlash } from "../lib/constants";

export class CompactService {
  async compact(inputMessages: UIMessage[]) {
    const messages = this.extractCompactMessages(inputMessages);
    const summary = await this.generateSummary(messages);

    const latestUserMessage = inputMessages.at(-1);
    if (latestUserMessage?.role !== "user") {
      throw new Error("Latest message is not from user");
    }

    const updatedUserMessage = {
      ...latestUserMessage,
      parts: [
        prompts.createCompactPart(summary.text, messages.length),
        ...latestUserMessage.parts,
      ],
    };

    return {
      messages: [...inputMessages.slice(0, -1), updatedUserMessage],
      totalTokens: summary.usage.totalTokens,
    };
  }

  private extractCompactMessages(messages: UIMessage[]) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.parts.some(prompts.isCompactPart)) {
        return messages.slice(i);
      }
    }
    return messages;
  }

  private async generateSummary(messages: UIMessage[]) {
    const summaryMessages: CoreMessage[] = [
      ...formatters.llm(messages),
      {
        role: "user",
        content:
          "Please provide a concise summary of the conversation above, focusing on key topics, decisions, and important context that should be preserved.",
      },
    ];
    return generateText({
      model: geminiFlash,
      messages: summaryMessages,
      temperature: 0.3,
      maxTokens: 3000,
      system: prompts.compact(),
      experimental_telemetry: {
        isEnabled: true,
      },
    });
  }
}

export const compactService = new CompactService();
