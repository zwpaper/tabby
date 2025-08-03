import { makeWorker } from "@livestore/adapter-web/worker";
import { makeCfSync } from "@livestore/sync-cf";
import { catalog } from "@ragdoll/livekit";

makeWorker({
  schema: catalog.schema,
  sync: {
    backend: makeCfSync({ url: import.meta.env.VITE_LIVESTORE_SYNC_URL }),
    initialSyncOptions: { _tag: "Blocking", timeout: 5000 },
  },
});
