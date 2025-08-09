import type { UseChatHelpers } from "@ai-v5-sdk/react";
import type { Message } from "@ragdoll/livekit";
import { useState } from "react";

export const useInlineCompactTask = ({
  sendMessage,
}: {} & Pick<UseChatHelpers<Message>, "sendMessage">) => {
  const [isPending, setIsPending] = useState(false);
  const inlineCompactTask = async () => {
    if (isPending) {
      return;
    }
    setIsPending(true);
    try {
      await sendMessage({
        text: "I've summarized the task and please analysis the current status, and use askFollowUpQuestion with me to confirm the next steps",
        metadata: {
          kind: "user",
          compact: true,
        },
      });
    } finally {
      setIsPending(false);
    }
  };

  return { inlineCompactTaskPending: isPending, inlineCompactTask };
};
