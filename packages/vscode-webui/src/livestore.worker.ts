import { makeWorker } from "@livestore/adapter-web/worker";
import { catalog } from "@ragdoll/livekit";

makeWorker({
  schema: catalog.schema,
});
