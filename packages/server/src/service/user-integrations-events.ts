import type { ExternalIntegrationsEvent } from "@ragdoll/db";
import Emittery from "emittery";

const emitter = new Emittery<{
  [userId: string]: ExternalIntegrationsEvent;
}>();

export const userIntegrationsEvents = {
  publish(event: ExternalIntegrationsEvent) {
    emitter.emit(event.data.userId, event);
  },

  subscribe(
    userId: string,
    listener: (event: ExternalIntegrationsEvent) => void,
  ) {
    emitter.on(userId, listener);
    return () => {
      emitter.off(userId, listener);
    };
  },
};
