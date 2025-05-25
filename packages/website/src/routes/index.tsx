import { Home, HomeWaitlist } from "@/components/home";
import { useWaitlistCheck } from "@/hooks/use-waitlist-check";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  input: z.string().optional(),
});

export const Route = createFileRoute("/")({
  component: Root,
  validateSearch: (search) => searchSchema.parse(search),
});

function Root() {
  const { auth } = Route.useRouteContext();

  // Use waitlist check hook to get latest waitlist approval status
  useWaitlistCheck();

  // If signed in, show HomeComponent
  if (auth) {
    return <Home />;
  }

  // If not signed in, show waitlist component
  return <HomeWaitlist />;
}
