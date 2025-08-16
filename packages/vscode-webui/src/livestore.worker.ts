import { catalog } from "@getpochi/livekit";
import { makeWorker } from "@livestore/adapter-web/worker";

makeWorker({
  schema: catalog.schema,
});
