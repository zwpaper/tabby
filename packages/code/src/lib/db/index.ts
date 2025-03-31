import {
  InstantReactAbstractDatabase,
  type InstantSchemaDef,
  i,
} from "@instantdb/react";
import NetworkListener from "./network-listener";
import Storage from "./storage";

class InstantNativeDatabase<
  Schema extends InstantSchemaDef<any, any, any>,
> extends InstantReactAbstractDatabase<Schema> {
  static Storage = Storage;
  static NetworkListener = NetworkListener;
}

const schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed(),
    }),
  },
});

function init() {
  // Convince InstantDB that we're in a browser
  (globalThis as any).chrome = {};
  const db = new InstantNativeDatabase({
    appId: "25fd3b3d-84b3-4049-a47c-f3c7163265d2",
    schema,
  });
  return db;
}

export const db = init();
