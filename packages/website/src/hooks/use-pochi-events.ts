import type { TaskEvent } from "@ragdoll/db";
import { createPochiEventSource } from "@ragdoll/server";
import { useEffect } from "react";

export function usePochiEvents<T extends TaskEvent>(
  uid: string | undefined,
  eventType: string,
  // FIXME(jueliang): consider using a ref to store the listener.
  listener: (event: T) => void,
) {
  useEffect(() => {
    if (!uid) {
      return;
    }

    const eventSource = createPochiEventSource(uid);
    const unsubscribe = eventSource.subscribe<T>(eventType, listener);

    return () => {
      unsubscribe();
      eventSource.dispose();
    };
  }, [uid, eventType, listener]);
}
