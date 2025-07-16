import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app.tsx";
import { ThemeProvider } from "./contexts/theme-context";

// Get theme from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const initialTheme = (urlParams.get("theme") as "light" | "dark") || "light";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider initialTheme={initialTheme}>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
