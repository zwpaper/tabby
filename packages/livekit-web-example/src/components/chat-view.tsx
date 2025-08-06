import { useChat } from "@ai-v5-sdk/react";
import type { RequestMetadata } from "@ragdoll/livekit";
import { useLiveChatKit } from "@ragdoll/livekit/react";
import { useEffect, useRef, useState } from "react";

export function ChatView() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { chat } = useLiveChatKit();
  const { messages, sendMessage, status } = useChat({ chat });

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
            sendMessage(
              { text: input },
              {
                metadata: {
                  llm: {
                    baseURL: "https://api.deepinfra.com/v1/openai",
                    apiKey: import.meta.env.VITE_DEEPINFRA_API_KEY,
                    modelId: "zai-org/GLM-4.5",
                    maxOutputTokens: 1024 * 14,
                    contextWindow: 128_000,
                  },
                } satisfies RequestMetadata,
              },
            );
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
