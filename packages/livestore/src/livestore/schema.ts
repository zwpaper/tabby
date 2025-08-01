import {
  Events,
  Schema,
  SessionIdSymbol,
  State,
  makeSchema,
} from "@livestore/livestore";

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
  tasks: State.SQLite.table({
    name: "tasks",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      createdAt: State.SQLite.integer(),
      updatedAt: State.SQLite.integer(),
    },
  }),
  // Many to one relationship with tasks
  messages: State.SQLite.table({
    name: "messages",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      taskId: State.SQLite.text(),
      seq: State.SQLite.integer(),
      data: State.SQLite.json({ schema: DBMessage }),
    },
  }),
  uiState: State.SQLite.clientDocument({
    name: "uiState",
    schema: Schema.Struct({
      taskId: Schema.optional(Schema.String),
    }),
    default: {
      id: SessionIdSymbol,
      value: {
        taskId: undefined,
      },
    },
  }),
};

// Events describe data changes (https://docs.livestore.dev/reference/events)
export const events = {
  taskCreated: Events.synced({
    name: "v1.TaskCreated",
    schema: Schema.Struct({
      id: Schema.String,
    }),
  }),
  messageUpdated: Events.synced({
    name: "v1.MessageUpdated",
    schema: Schema.Struct({
      taskId: Schema.String,
      seq: Schema.Number,
      data: DBMessage,
    }),
  }),
  uiStateSet: tables.uiState.set,
};

// Materializers are used to map events to state (https://docs.livestore.dev/reference/state/materializers)
const materializers = State.SQLite.materializers(events, {
  "v1.TaskCreated": ({ id }) =>
    tables.tasks.insert({
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  "v1.MessageUpdated": ({ taskId, seq, data }) =>
    tables.messages
      .insert({
        id: data.id,
        seq,
        taskId,
        data,
      })
      .onConflict("id", "replace"),
});

const state = State.SQLite.makeState({ tables, materializers });

export const schema = makeSchema({ events, state });
