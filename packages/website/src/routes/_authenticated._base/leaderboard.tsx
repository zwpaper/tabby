import { UsageLeaderboard } from "@/components/team/leaderboard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_base/leaderboard")({
  component: UsageLeaderboard,
});
