import { apiClient, createUserEventSource } from "@/lib/api";
import { useRouter } from "@/lib/router";
import { Spinner } from "@inkjs/ui";
import type { UserEvent } from "@ragdoll/server";
import { Box } from "ink";
import { useCallback, useEffect, useState } from "react";

export default function ListenPage({ listen }: { listen: string }) {
  const { navigate } = useRouter();
  const [event, setEvent] = useState<UserEvent | null>();
  useEffect(() => {
    const source = createUserEventSource();
    source.subscribe(listen, setEvent);
    return () => source.dispose();
  }, [listen]);

  const createTask = useCallback(
    async (event: UserEvent) => {
      const res = await apiClient.api.tasks.$post({
        json: {
          event,
        },
      });

      if (res.ok) {
        const { id } = await res.json();
        navigate({
          route: "/chat",
          params: { id },
        });
      } else {
        throw new Error("Failed to create task");
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (event) {
      createTask(event);
    }
  }, [createTask, event]);

  if (!event) {
    return (
      <Box
        width="100%"
        height="100%"
        justifyContent="center"
        alignItems="center"
      >
        <Spinner label="Waiting for event..." />
      </Box>
    );
  }
}
