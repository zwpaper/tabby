import { createFileRoute } from "@tanstack/react-router";

import { TaskContent } from "@/components/task/content";
import { apiClient } from "@/lib/auth-client";
import { normalizeApiError, toHttpError } from "@/lib/error";
import { toUIMessages } from "@ragdoll/common";

export const Route = createFileRoute("/clip/$id")({
  loader: async ({ params }) => {
    const { id } = params;
    try {
      const response = await apiClient.api.clips[":id"].$get({
        param: {
          id,
        },
      });
      if (!response.ok) {
        throw toHttpError(response);
      }
      return response.json();
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
  component: ClipView,
});

function ClipView() {
  const { data } = Route.useLoaderData();
  const renderMessages = toUIMessages(data.messages || []);

  if (!renderMessages || renderMessages.length === 0) {
    return (
      <div className="p-4">
        <p>No messages in this clip.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 font-bold text-2xl">Clip</h1>
      <TaskContent messages={renderMessages} />
    </div>
  );
}
