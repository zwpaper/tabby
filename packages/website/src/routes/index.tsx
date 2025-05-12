import { Home, HomeWaitlist } from "@/components/home";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  input: z.string().optional(),
});

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    if (
      context.auth &&
      !context.auth.user.isWaitlistApproved &&
      !context.auth.user.email.endsWith("@tabbyml.com")
    ) {
      throw redirect({
        to: "/waitlist",
      });
    }
  },
  component: Root,
  validateSearch: (search) => searchSchema.parse(search),
});

function Root() {
  const { auth } = Route.useRouteContext();

  // If signed in, show HomeComponent
  if (auth) {
    return <Home />;
  }

  // If not signed in, show waitlist component
  return <HomeWaitlist />;
}
