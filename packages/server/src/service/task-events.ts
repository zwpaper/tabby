import type { TaskEvent } from "@ragdoll/db";

import Emittery from "emittery";

const emitter = new Emittery<{
  [uid: string]: TaskEvent;
}>();

export const taskEvents = {
  publish(event: TaskEvent) {
    emitter.emit(event.data.uid, event);
  },

  subscribe(uid: string, listener: (event: TaskEvent) => void) {
    emitter.on(uid, listener);
    return () => {
      emitter.off(uid, listener);
    };
  },
};
