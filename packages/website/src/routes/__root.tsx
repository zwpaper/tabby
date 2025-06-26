import { Footer } from "@/components/footer";
import type { authClient } from "@/lib/auth-client";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
  useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

interface RouterContext {
  auth: typeof authClient.$Infer.Session;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        title: "Pochi - Your AI powered team mate",
      },
      {
        name: "description",
        content: "Chat with Pochi to generate and ship applications.",
      },
    ],
  }),

  component: () => {
    const location = useLocation();
    const isAuthPage = location.pathname.startsWith("/auth");

    return (
      <>
        <HeadContent />
        <div className={`min-h-screen ${!isAuthPage ? "pb-16" : ""}`}>
          <Outlet />
        </div>
        {!isAuthPage && <Footer />}
        <TanStackRouterDevtools position="bottom-right" />
      </>
    );
  },
});
