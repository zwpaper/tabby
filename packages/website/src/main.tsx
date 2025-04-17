import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

import "./styles.css";
import { Loader2 } from "lucide-react";
import { useSession } from "./lib/auth-hooks.ts";
import { Providers } from "./providers.tsx";
import reportWebVitals from "./reportWebVitals.ts";

// Create a new router instance
const router = createRouter({
  routeTree,
  context: {
    auth: null,
  },
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
});

export type Router = typeof router;

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function InnerApp() {
  const { data: auth, isPending } = useSession();
  if (isPending) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  return (
    <StrictMode>
      <RouterProvider router={router} context={{ auth }} />
    </StrictMode>
  );
}

function App() {
  return (
    <Providers router={router}>
      <InnerApp />
    </Providers>
  );
}

// Render the app
const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
