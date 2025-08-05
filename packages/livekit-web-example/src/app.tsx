import { makePersistedAdapter } from "@livestore/adapter-web";
import LiveStoreSharedWorker from "@livestore/adapter-web/shared-worker?sharedworker";
import { LiveStoreProvider } from "@livestore/react";
import { FPSMeter } from "@overengineering/fps-meter";
import type React from "react";
import { unstable_batchedUpdates as batchUpdates } from "react-dom";

import { catalog } from "@ragdoll/livekit";
import Page from "./components/chat.js";
import { getTaskId } from "./lib/workspace-id.js";
import LiveStoreWorker from "./livestore.worker?worker";

const AppBody: React.FC = () => (
  <div className="page-container">
    <section className="todoapp">
      <Page />
    </section>
  </div>
);

const resetPersistence =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("reset") !== null;

if (resetPersistence) {
  const searchParams = new URLSearchParams(window.location.search);
  searchParams.delete("reset");
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}?${searchParams.toString()}`,
  );
}

const adapter = makePersistedAdapter({
  storage: { type: "opfs" },
  worker: LiveStoreWorker,
  sharedWorker: LiveStoreSharedWorker,
  resetPersistence,
});

const taskId = getTaskId();

export const App: React.FC = () => (
  <LiveStoreProvider
    schema={catalog.schema}
    adapter={adapter}
    renderLoading={(_) => <div>Loading LiveStore ({_.stage})...</div>}
    batchUpdates={batchUpdates}
    storeId={taskId}
  >
    <div style={{ top: 0, right: 0, position: "absolute", background: "#333" }}>
      <FPSMeter height={40} />
    </div>
    <AppBody />
  </LiveStoreProvider>
);
