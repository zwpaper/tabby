import { useMemo } from "react";
import type { Message } from "../types";

// Helper function to extract API requests from messages
const extractApiRequests = (messages: Message[]): ApiRequestEntry[] => {
  const requests: ApiRequestEntry[] = [];
  let globalIndex = 1;
  messages.forEach((message, messageIndex) => {
    if (
      (message.role === "assistant" || message.role === "user") &&
      Array.isArray(message.content)
    ) {
      message.content.forEach((part, partIndex) => {
        const text = part.newText ?? part.text;
        if (typeof text === "string") {
          // Use the same regex pattern as message-content.tsx
          const parts = text.split(
            /(<api-request .*?<\/api-request>|<(?:system-reminder|user-reminder)>[\s\S]*?<\/(?:system-reminder|user-reminder)>|<environment-details>[\s\S]*?<\/environment-details>)/gs,
          );
          let requestCounter = 0;
          // biome-ignore lint/complexity/noForEach: <explanation>
          parts.forEach((splitPart) => {
            const isApiRequest = /(<api-request .*?<\/api-request>)/gs.test(
              splitPart,
            );
            const isSystemReminder =
              /(<(?:system-reminder|user-reminder)>[\s\S]*?<\/(?:system-reminder|user-reminder)>)/gs.test(
                splitPart,
              );
            const isEnvironmentDetails =
              /(<environment-details>[\s\S]*?<\/environment-details>)/gs.test(
                splitPart,
              );

            if (isApiRequest || isSystemReminder || isEnvironmentDetails) {
              let name: string;
              if (isApiRequest) {
                // Extract the name from api-request
                const nameMatch = splitPart.match(
                  /<api-request name="([^"]+)">/,
                );
                name = nameMatch ? nameMatch[1] : "api-request";
              } else if (isSystemReminder) {
                // Both system-reminder and user-reminder are treated as "system-reminder"
                name = "system-reminder";
              } else {
                name = "environment-details";
              }

              requests.push({
                name: name,
                messageIndex,
                partIndex,
                requestIndexInPart: requestCounter++,
                globalIndex: globalIndex++,
              });
            }
          });
        }
      });
    }
  });
  return requests;
};

export interface ApiRequestEntry {
  name: string;
  messageIndex: number;
  partIndex: number;
  requestIndexInPart: number;
  globalIndex: number;
}

export interface ConversationRound {
  roundIndex: number;
  userMessageIndex?: number;
  assistantMessageIndex?: number;
  startMessageIndex: number;
  endMessageIndex: number;
  apiRequests: ApiRequestEntry[];
  title: string;
}

export interface MessageWithRound extends Message {
  roundIndex?: number;
  isRoundStart?: boolean;
}

// Helper function to extract conversation rounds
const extractConversationRounds = (
  messages: Message[],
): ConversationRound[] => {
  const rounds: ConversationRound[] = [];
  let currentRound: ConversationRound | null = null;
  let roundIndex = 1;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    if (message.role === "user") {
      // Finalize previous round if exists
      if (currentRound) {
        currentRound.endMessageIndex = i - 1;
        rounds.push(currentRound);
      }

      // Start new round - every user message starts a new round
      currentRound = {
        roundIndex: roundIndex++,
        userMessageIndex: i,
        startMessageIndex: i,
        endMessageIndex: i,
        apiRequests: [],
        title: `Round ${roundIndex - 1}`,
      };
    } else if (message.role === "assistant" && currentRound) {
      // Assistant message continues current round
      currentRound.assistantMessageIndex = i;
      currentRound.endMessageIndex = i;
    }
    // System messages are included in the current round but don't affect round boundaries
  }

  // Finalize last round
  if (currentRound) {
    currentRound.endMessageIndex = messages.length - 1;
    rounds.push(currentRound);
  }

  return rounds;
};

// Helper function to annotate messages with round information
const annotateMessagesWithRounds = (
  messages: Message[],
  rounds: ConversationRound[],
): MessageWithRound[] => {
  return messages.map((message, index) => {
    const round = rounds.find(
      (r) => index >= r.startMessageIndex && index <= r.endMessageIndex,
    );

    return {
      ...message,
      roundIndex: round?.roundIndex,
      isRoundStart: round?.startMessageIndex === index,
    };
  });
};

export const useRounds = (messages: Message[]) => {
  const apiRequests = useMemo(() => extractApiRequests(messages), [messages]);
  const baseRounds = useMemo(
    () => extractConversationRounds(messages),
    [messages],
  );

  // Assign API requests to their corresponding rounds
  const rounds = useMemo(() => {
    return baseRounds.map((round) => {
      const roundRequests = apiRequests.filter(
        (req) =>
          req.messageIndex >= round.startMessageIndex &&
          req.messageIndex <= round.endMessageIndex,
      );
      return { ...round, apiRequests: roundRequests };
    });
  }, [baseRounds, apiRequests]);

  const messagesWithRounds = useMemo(
    () => annotateMessagesWithRounds(messages, rounds),
    [messages, rounds],
  );

  const getRoundByMessageIndex = (
    messageIndex: number,
  ): ConversationRound | undefined => {
    return rounds.find(
      (round) =>
        messageIndex >= round.startMessageIndex &&
        messageIndex <= round.endMessageIndex,
    );
  };

  const getRoundTitle = (messageIndex: number): string | undefined => {
    const round = getRoundByMessageIndex(messageIndex);
    if (!round) return undefined;

    const userNum =
      round.userMessageIndex !== undefined ? round.userMessageIndex + 1 : "?";
    const assistantNum =
      round.assistantMessageIndex !== undefined
        ? round.assistantMessageIndex + 1
        : "?";

    return `Round #${round.roundIndex} (user #${userNum}/assistant #${assistantNum})`;
  };

  return {
    rounds,
    messagesWithRounds,
    apiRequests,
    getRoundByMessageIndex,
    getRoundTitle,
  };
};
