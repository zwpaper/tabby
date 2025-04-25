import { useRouter } from "@/lib/router";
import { useUserEvent } from "@/lib/user-event";
import { Spinner } from "@inkjs/ui";
import type { UserEvent } from "@ragdoll/server";
import { Box } from "ink";
import { useCallback, useEffect } from "react";

export default function ListenPage() {
  const { navigate, initialPromptSent } = useRouter();
  const { dequeueEvent } = useUserEvent(); // Get event from context

  useEffect(() => {
    initialPromptSent.current = false;
  }, [initialPromptSent]);

  const createTask = useCallback(
    async (event: UserEvent) => {
      navigate({
        route: "/chat",
        params: { event },
      });
    },
    [navigate],
  );

  useEffect(() => {
    const handle = setInterval(() => {
      const event = dequeueEvent();
      if (event) {
        createTask(event);
      }
    }, 1000);
    return () => clearInterval(handle);
  }, [createTask, dequeueEvent]); // Dependency on event from context

  // Always render the spinner while waiting for an event or processing the task creation/navigation
  return (
    <Box width="100%" height="100%" justifyContent="center" alignItems="center">
      <Spinner label="Waiting for event..." />
    </Box>
  );
}
