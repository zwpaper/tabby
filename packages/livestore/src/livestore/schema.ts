import { Events, Schema, State, makeSchema } from "@livestore/livestore";

const DBTextUIPart = Schema.Struct({
  type: Schema.Literal("text"),
  text: Schema.String,
  state: Schema.optional(Schema.Literal("streaming", "done")),
});

const DBMessage = Schema.Struct({
  id: Schema.String,
  role: Schema.Literal("user", "assistant", "system"),
  parts: Schema.Array(Schema.Union(DBTextUIPart, Schema.Unknown)),
});

export const tables = {
  // Contains only one row as this store is per-task.
  environment: State.SQLite.table({
    name: "environment",
    columns: {
      id: State.SQLite.integer({ primaryKey: true }),
      data: State.SQLite.json({
        nullable: true,
        default: null,
        schema: Schema.JsonValue,
      }),
    },
  }),
  messages: State.SQLite.table({
    name: "messages",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      seq: State.SQLite.integer(),
      data: State.SQLite.json({ schema: DBMessage }),
    },
  }),
};

// Events describe data changes (https://docs.livestore.dev/reference/events)
export const events = {
  messageCreated: Events.synced({
    name: "v1.MessageCreated",
    schema: Schema.Struct({ seq: Schema.Number, data: DBMessage }),
  }),
  environmentSet: Events.synced({
    name: "v1.EnvironmentSet",
    schema: Schema.Struct({ environment: Schema.JsonValue }),
  }),
  // uiStateSet: tables.uiState.set,
};

// Materializers are used to map events to state (https://docs.livestore.dev/reference/state/materializers)
const materializers = State.SQLite.materializers(events, {
  "v1.MessageCreated": ({ seq, data }) =>
    tables.messages.insert({
      id: data.id,
      data,
      seq,
    }),

  "v1.EnvironmentSet": ({ environment }) =>
    tables.environment
      .insert({ id: 1, data: environment })
      .onConflict("id", "replace"),
});

const max = tables.messages.select("id").orderBy("id", "desc").first();

const state = State.SQLite.makeState({ tables, materializers });

export const schema = makeSchema({ events, state });
