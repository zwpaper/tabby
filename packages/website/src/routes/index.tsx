import { HomeWaitlist } from "@/components/home";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    if (context.auth?.user) {
      throw redirect({
        to: "/home",
      });
    }
  },
  component: HomeWaitlist,
});
