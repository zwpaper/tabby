import { MinionList } from "@/components/minions/minion-list";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/minions")({
  component: Minions,
});

function Minions() {
  return <MinionList />;
}
