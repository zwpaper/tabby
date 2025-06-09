import Emittery from "emittery";
import { useCallback, useEffect } from "react";

interface SendMessagePayload {
  prompt: string;
}

const emitter = new Emittery<{
  sendMessage: SendMessagePayload;
}>();

type AppendMessage = (message: { content: string; role: "user" }) => void;

export function useSendMessage() {
  const sendMessage = useCallback((payload: SendMessagePayload) => {
    emitter.emit("sendMessage", payload);
  }, []);

  return sendMessage;
}

export function useHandleChatEvents(append?: AppendMessage) {
  useEffect(() => {
    if (!append) return;

    const unsubscribe = emitter.on("sendMessage", async (payload) => {
      append({
        content: payload.prompt,
        role: "user",
      });
    });

    return unsubscribe;
  }, [append]);
}
