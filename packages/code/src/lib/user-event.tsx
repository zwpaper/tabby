import { createUserEventSource } from "@/lib/api";
import type { UserEvent } from "@ragdoll/server";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAppConfig } from "./app-config";

// ContextType exposes only the oldest event (or null) and the dequeue function
interface UserEventContextType {
  dequeueEvent: () => UserEvent | undefined; // Function to get and remove the oldest event
}

const UserEventContext = createContext<UserEventContextType | undefined>(
  undefined,
);

export function UserEventProvider({ children }: { children: ReactNode }) {
  const appConfig = useAppConfig();
  const [events, setEvents] = useState<UserEvent[]>([]); // Internal state remains an array (queue)

  useEffect(() => {
    let source: ReturnType<typeof createUserEventSource> | null = null;

    if (appConfig.listen) {
      source = createUserEventSource();
      source.subscribe(appConfig.listen, (e) => {
        setEvents((prevEvents) => [...prevEvents, e]);
      });
    }

    // Cleanup function
    return () => {
      setEvents([]); // Clear the internal queue on cleanup/route change
      source?.dispose();
    };
  }, [appConfig.listen]); // Re-run effect if the router path changes

  // Function to dequeue the oldest event from the internal queue
  const firstEvent = events[0];
  const dequeueEvent = useCallback(() => {
    setEvents((prevEvents) => prevEvents.slice(1));
    return firstEvent;
  }, [firstEvent]);

  // The value provided by the context exposes the oldest event (events[0])
  // and the dequeue function.
  return (
    <UserEventContext.Provider
      value={{
        dequeueEvent,
      }}
    >
      {children}
    </UserEventContext.Provider>
  );
}

export function useUserEvent() {
  const context = useContext(UserEventContext);
  if (context === undefined) {
    throw new Error("useUserEvent must be used within a UserEventProvider");
  }
  return context;
}
