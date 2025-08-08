import { apiClient } from "@/lib/auth-client";
import { fromUIMessages } from "@ragdoll/common";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

// FIXME(zhanba): migrate this to v5
// ast-grep-ignore: no-ai-sdk-v4
import type { UIMessage } from "ai";

export const useCompactNewTask = ({
  uid,
  messages,
  enabled,
}: {
  uid?: string;
  messages: UIMessage[];
  enabled: boolean;
}) => {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!uid || !enabled) {
        return;
      }
      const lastMessage = messages.at(-1);
      if (!lastMessage) {
        throw new Error("No messages available to compact.");
      }
      const messagesToSend =
        lastMessage.role === "user" ? messages.slice(-2) : messages.slice(-1);
      const res = await apiClient.api.tasks.$post({
        json: {
          prompt:
            "I've summarized the task and start a new task with the summary. Please analysis the current status, and use askFollowUpQuestion with me to confirm the next steps",
          event: {
            type: "vscode:compact-new-task",
            data: {
              sourceUid: uid,
              messages: fromUIMessages(messagesToSend),
            },
          },
        },
      });
      if (res.status === 200) {
        const data = await res.json();
        if (data.success && data.uid) {
          return data.uid;
        }
        throw new Error("Failed to compact new task, no uid returned");
      }
      throw new Error(`Failed to compact new task: ${await res.text()}`);
    },
    onSuccess: (newUid) => {
      router.navigate({ to: "/", search: { uid: newUid, ts: Date.now() } });
    },
  });

  return {
    isCompactingNewTask: mutation.isPending,
    handleCompactNewTask: () => mutation.mutate(),
    error: mutation.error ?? undefined,
  };
};
