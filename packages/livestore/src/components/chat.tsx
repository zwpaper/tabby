import {
  DefaultChatTransport,
  convertToModelMessages,
  streamText,
} from "@ai-v5-sdk/ai";
import { createOpenAICompatible } from "@ai-v5-sdk/openai-compatible";
import { type UIMessage, useChat } from "@ai-v5-sdk/react";
import { queryDb } from "@livestore/livestore";
import { useStore } from "@livestore/react";
import { useState } from "react";
import { messageSeq } from "../livestore/queries";
import { events, tables } from "../livestore/schema";

const messages$ = queryDb(
  () => {
    return tables.messages.orderBy("seq", "asc");
  },
  { label: "messages" },
);

const environment$ = queryDb(
  () => {
    return tables.environment.select().where("id", "=", 1).first();
  },
  { label: "environment" },
);

export default function Chat() {
  const { store } = useStore();
  const initMessages = store
    .useQuery(messages$)
    .map((x) => x.data as UIMessage);
  const environment = store.useQuery(environment$);

  const { messages, sendMessage, status } = useChat({
    messages: initMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: customFetch,
      prepareSendMessagesRequest: ({ id, messages }) => {
        const lastMessage = messages.at(-1);
        if (lastMessage?.role === "user") {
          store.commit(
            events.messageCreated({
              seq: store.query(messageSeq(lastMessage.id)),
              data: lastMessage,
            }),
          );
        }
        return {
          body: {
            id,
            messages,
          },
        };
      },
    }),
    onFinish: ({ message }) => {
      store.commit(
        events.messageCreated({
          seq: store.query(messageSeq(message.id)),
          data: message,
        }),
      );
    },
  });
  const [input, setInput] = useState("");

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>LiveStore Chat</h1>
        <div className="environment-display">
          <strong>Environment:</strong>
          <pre>{JSON.stringify(environment?.data, null, 2)}</pre>
        </div>
      </div>

      <div className="message-container">
        {messages.map((message) => (
          <div key={message.id} className={`message-bubble ${message.role}`}>
            <div className="message-text">
              <strong>{message.role === "user" ? "You" : "AI"}</strong>
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
          <div className="typing-indicator">Typing...</div>
        )}
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

const openai = createOpenAICompatible({
  baseURL: "https://api.deepinfra.com/v1/openai",
  apiKey: import.meta.env.VITE_DEEPINFRA_API_KEY,
  name: "deepinfra",
});

const customFetch: typeof fetch = async (input, init) => {
  if (input !== "/api/chat") {
    return fetch(input, init);
  }

  if (typeof init?.body !== "string") {
    throw new Error("Request body is required for custom fetch implementation");
  }

  const { messages } = JSON.parse(init.body);
  const result = streamText({
    model: openai("moonshotai/Kimi-K2-Instruct"),
    messages: convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse();
};
