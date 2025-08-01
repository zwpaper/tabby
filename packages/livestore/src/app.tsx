/* eslint-disable unicorn/prefer-global-this */
import { makePersistedAdapter } from "@livestore/adapter-web";
import LiveStoreSharedWorker from "@livestore/adapter-web/shared-worker?sharedworker";
import { LiveStoreProvider } from "@livestore/react";
import { FPSMeter } from "@overengineering/fps-meter";
import type React from "react";
import { unstable_batchedUpdates as batchUpdates } from "react-dom";

import Chat from "./components/chat.js";
import { InputForm } from "./components/input-form";
import { getStoreId } from "./lib/store-id.js";
import LiveStoreWorker from "./livestore.worker?worker";
import { schema } from "./livestore/schema.js";

const AppBody: React.FC = () => (
  <div className="page-container">
    <section className="todoapp">
      <InputForm />
      <Chat />
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

const storeId = getStoreId();

export const App: React.FC = () => (
  <LiveStoreProvider
    schema={schema}
    adapter={adapter}
    renderLoading={(_) => <div>Loading LiveStore ({_.stage})...</div>}
    batchUpdates={batchUpdates}
    storeId={storeId}
  >
    <div style={{ top: 0, right: 0, position: "absolute", background: "#333" }}>
      <FPSMeter height={40} />
    </div>
    <AppBody />
  </LiveStoreProvider>
);
