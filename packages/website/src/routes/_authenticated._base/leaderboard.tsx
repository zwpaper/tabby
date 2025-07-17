import { UsageLeaderboard } from "@/components/organization/leaderboard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_base/leaderboard")({
  component: UsageLeaderboard,
});
