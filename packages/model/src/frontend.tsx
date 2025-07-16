import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app.tsx";

// Get theme from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const theme = urlParams.get("theme") || "light";

// Apply theme to document root
const documentRoot = document.documentElement;
documentRoot.classList.remove("light", "dark");
documentRoot.classList.add(theme === "dark" ? "dark" : "light");

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
