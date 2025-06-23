import { HomeWaitlist } from "@/components/home";
import {
  isUserWaitlistApproved,
  useWaitlistCheck,
} from "@/hooks/use-waitlist-check";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  input: z.string().optional(),
});

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    if (isUserWaitlistApproved(context.auth?.user)) {
      throw redirect({
        to: "/home",
      });
    }
  },
  component: Root,
  validateSearch: (search) => searchSchema.parse(search),
});

function Root() {
  // Use waitlist check hook to get latest waitlist approval status
  useWaitlistCheck();

  return <HomeWaitlist />;
}
