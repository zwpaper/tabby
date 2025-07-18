import { Footer } from "@/components/footer";
import type { authClient } from "@/lib/auth-client";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
  useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";

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

    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
      const handleScroll = () => {
        setScrolled(true);
      };

      window.addEventListener("wheel", handleScroll);
      return () => {
        window.removeEventListener("wheel", handleScroll);
      };
    }, []);

    return (
      <>
        <HeadContent />
        <div className="min-h-screen">
          <Outlet />
        </div>
        {!isAuthPage && scrolled && <Footer />}
        <TanStackRouterDevtools position="bottom-right" />
      </>
    );
  },
});
