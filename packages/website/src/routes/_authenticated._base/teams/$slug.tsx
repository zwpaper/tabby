import { TeamView } from "@/components/team/team-view";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_base/teams/$slug")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  return <TeamView slug={slug} />;
}
