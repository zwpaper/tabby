import "./styles.css";

import { StrictMode, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { MessageList } from "./components/message/message-list";
import {
  type Theme,
  ThemeProvider,
  useTheme,
} from "./components/theme-provider";
import { VSCodeWebProvider } from "./components/vscode-web-provider";
import { ChatContextProvider } from "./features/chat";
import { Placeholder } from "./features/share";

function InnerApp() {
  const { setTheme } = useTheme();
  const theme = new URLSearchParams(location.search).get("theme") || "light";
  useEffect(() => {
    setTheme(theme as Theme);
  }, [theme, setTheme]);

  const [messages, setMessages] = useState(Placeholder);
  useEffect(() => {
    window.addEventListener("message", (event: MessageEvent) => {
      if (typeof event.data === "object" && event.data?.type === "share") {
        setMessages(event.data.messages);
      }
    });
  }, []);

  return (
    <VSCodeWebProvider>
      <ChatContextProvider>
        <MessageList messages={messages} isLoading={false} />
      </ChatContextProvider>
    </VSCodeWebProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <InnerApp />
    </ThemeProvider>
  );
}

// Render the app
const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
