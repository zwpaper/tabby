import { ChatPage } from "@/features/chat";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import "@/components/prompt-form/prompt-form.css";

const searchSchema = z.object({
  uid: z.string().optional(),
  ts: z.number().optional(),
});

export const Route = createFileRoute("/_auth/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: RouteComponent,
});

function RouteComponent() {
  const { uid: uidFromRoute, ts = Date.now() } = Route.useSearch();
  const key = uidFromRoute !== undefined ? `task-${uidFromRoute}` : `new-${ts}`;

  const { auth } = Route.useRouteContext();
  const uid = uidFromRoute || crypto.randomUUID();
  return <ChatPage key={key} user={auth?.user} uid={uid} />;
}
