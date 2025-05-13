import { HomeWaitlistApproval } from "@/components/home";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/waitlist")({
  beforeLoad: async ({ context }) => {
    // If user is not logged in, redirect to home page
    if (!context.auth) {
      throw redirect({
        to: "/",
      });
    }
  },
  component: HomeWaitlistApproval,
});
