import type { UIMessage } from "@ai-v5-sdk/react";
import { useChat } from "@ai-v5-sdk/react";
import { useStore } from "@livestore/react";
import { useEffect, useRef, useState } from "react";
import { FlexibleChatTransport } from "../lib/chat-api";
import { messageSeq$, messages$, uiState$ } from "../livestore/queries";
import { events } from "../livestore/schema";

export function ChatView() {
  const { store } = useStore();
  const { taskId } = store.useQuery(uiState$);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initMessages = store
    .useQuery(messages$)
    .map((x) => x.data as UIMessage);

  const { messages, sendMessage, status } = useChat({
    generateId: () => crypto.randomUUID(),
    messages: initMessages,
    transport: new FlexibleChatTransport({
      onStart: ({ messages }) => {
        const lastMessage = messages.at(-1);
        if (lastMessage?.role === "user" && taskId) {
          store.commit(
            events.messageUpdated({
              taskId,
              seq: store.query(messageSeq$(taskId, lastMessage.id)),
              data: lastMessage,
            }),
          );
        }
      },
    }),
    onFinish: ({ message }) => {
      if (taskId) {
        store.commit(
          events.messageUpdated({
            taskId,
            seq: store.query(messageSeq$(taskId, message.id)),
            data: message,
          }),
        );
      }
    },
  });

  const [input, setInput] = useState("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="chat-container">
      <div className="message-container">
        {messages.map((message) => (
          <div key={message.id} className={`message-bubble ${message.role}`}>
            <div className="message-text">
              <div className="message-role">
                {message.role === "user" ? "You" : "AI"}
              </div>
              <div>
                {message.parts.map((part, index) =>
                  part.type === "text" ? (
                    <span key={index}>{part.text}</span>
                  ) : null,
                )}
              </div>
            </div>
          </div>
        ))}
        {status === "streaming" && (
          <div className="message-bubble ai">
            <div className="typing-indicator">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput("");
          }
        }}
        className="chat-form"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== "ready"}
          placeholder="Say something..."
          className="chat-input"
        />
        <button
          type="submit"
          disabled={status !== "ready"}
          className="send-button"
        >
          {status === "ready" ? "Send" : "Sending..."}
        </button>
      </form>
    </div>
  );
}
