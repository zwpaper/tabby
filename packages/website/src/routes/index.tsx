import { Home, HomeWaitlist } from "@/components/home";
import { useWaitlistCheck } from "@/hooks/use-waitlist-check";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  enableRemotePochi: z.boolean().optional(),
  input: z.string().optional(),
});

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    if (context.auth?.user.isWaitlistApproved) {
      throw redirect({
        to: "/home",
      });
    }
  },
  component: Root,
  validateSearch: (search) => searchSchema.parse(search),
});

function Root() {
  const { auth } = Route.useRouteContext();
  const { enableRemotePochi } = Route.useSearch();

  // Use waitlist check hook to get latest waitlist approval status
  useWaitlistCheck();

  // If signed in, show HomeComponent
  if (auth) {
    return <Home enableRemotePochi={enableRemotePochi} />;
  }

  // If not signed in, show waitlist component
  return <HomeWaitlist />;
}
