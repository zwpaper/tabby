import { makeAdapter } from "@livestore/adapter-node";
import { type LiveStoreSchema, createStorePromise } from "@livestore/livestore";
import { catalog, getStoreId } from "@ragdoll/livekit";

const adapter = makeAdapter({
  storage: { type: "fs", baseDirectory: "./data" },
  devtools: {
    schemaPath: "../../packages/livekit/src/livestore/schema.ts",
  },
});

export async function createStore(cwd: string) {
  const storeId = getStoreId(cwd);
  const store = await createStorePromise<LiveStoreSchema>({
    adapter,
    schema: catalog.schema,
    storeId: storeId,
  });
  return store;
}
