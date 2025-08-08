import type { UseChatHelpers } from "@ai-v5-sdk/react";
import type { Message } from "@ragdoll/livekit";
import Emittery from "emittery";
import { useCallback, useEffect } from "react";

interface SendMessagePayload {
  prompt: string;
}

const emitter = new Emittery<{
  sendMessage: SendMessagePayload;
}>();

export function useSendMessage() {
  const sendMessage = useCallback((payload: SendMessagePayload) => {
    emitter.emit("sendMessage", payload);
  }, []);

  return sendMessage;
}

export function useHandleChatEvents(
  sendMessage?: UseChatHelpers<Message>["sendMessage"],
) {
  useEffect(() => {
    if (!sendMessage) return;

    const unsubscribe = emitter.on("sendMessage", async (payload) => {
      sendMessage({
        text: payload.prompt,
      });
    });

    return unsubscribe;
  }, [sendMessage]);
}
