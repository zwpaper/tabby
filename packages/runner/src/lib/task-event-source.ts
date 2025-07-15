import { createPochiEventSource } from "@ragdoll/server";
import type { RunnerOptions } from "../task-runner";

export function createTaskEventSource({
  uid,
  apiClient,
  accessToken,
}: {
  uid: string;
  apiClient: RunnerOptions["apiClient"];
  accessToken: string;
}) {
  // FIXME(zhiming): can we get token from apiClient, or build EventSource with apiClient?
  const baseUrl = apiClient.api.tasks[":uid"].events.$url({
    param: { uid },
  });
  baseUrl.pathname = "";
  const baseUrlString = baseUrl.toString();
  return createPochiEventSource(uid, baseUrlString, accessToken);
}
