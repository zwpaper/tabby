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

const Todo = Schema.Struct({
  id: Schema.String,
  content: Schema.String,
  status: Schema.Literal("pending", "in-progress", "completed", "cancelled"),
  priority: Schema.Literal("low", "medium", "high"),
});

const Todos = Schema.Array(Todo);

const TaskStatus = Schema.Literal(
  "completed",
  "pending-input",
  "failed",
  "streaming",
  "pending-tool",
  "pending-model",
);

const TaskError = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal("InternalError"),
    message: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("APICallError"),
    message: Schema.String,
    requestBodyValues: Schema.Unknown,
  }),
  Schema.Struct({
    kind: Schema.Literal("AbortError"),
    message: Schema.String,
  }),
);

export const tables = {
  task: State.SQLite.table({
    name: "task",
    columns: {
      id: State.SQLite.text({
        primaryKey: true,
        schema: Schema.Literal("default"),
      }),
      status: State.SQLite.text({
        default: "pending-input",
        schema: TaskStatus,
      }),
      todos: State.SQLite.json({
        default: [],
        schema: Todos,
      }),
      totalTokens: State.SQLite.integer({ nullable: true }),
      error: State.SQLite.json({ schema: TaskError, nullable: true }),
      createdAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
      updatedAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
    },
  }),
  // Many to one relationship with tasks
  messages: State.SQLite.table({
    name: "messages",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      data: State.SQLite.json({ schema: DBMessage }),
    },
  }),
};

// Events describe data changes (https://docs.livestore.dev/reference/events)
export const events = {
  taskInited: Events.synced({
    name: "v1.TaskInited",
    schema: Schema.Struct({
      createdAt: Schema.Date,
    }),
  }),
  chatStreamStarted: Events.synced({
    name: "v1.ChatStreamStarted",
    schema: Schema.Struct({
      data: DBMessage,
      todos: Todos,
      updatedAt: Schema.Date,
    }),
  }),
  chatStreamFinished: Events.synced({
    name: "v1.ChatStreamFinished",
    schema: Schema.Struct({
      data: DBMessage,
      totalTokens: Schema.NullOr(Schema.Number),
      status: TaskStatus,
      updatedAt: Schema.Date,
    }),
  }),
  chatStreamFailed: Events.synced({
    name: "v1.ChatStreamFailed",
    schema: Schema.Struct({
      error: TaskError,
      updatedAt: Schema.Date,
    }),
  }),
};

// Materializers are used to map events to state (https://docs.livestore.dev/reference/state/materializers)
const materializers = State.SQLite.materializers(events, {
  "v1.TaskInited": ({ createdAt }, ctx) => {
    const countTask = ctx.query(tables.task.count());
    if (countTask !== 0) return [];

    return [
      tables.task.insert({
        id: "default",
        status: "pending-input",
        createdAt,
        updatedAt: createdAt,
      }),
    ];
  },
  "v1.ChatStreamStarted": ({ data, todos, updatedAt }) => [
    tables.task
      .update({
        status: "streaming",
        todos,
        updatedAt,
      })
      .where({ id: "default" }),
    tables.messages
      .insert({
        id: data.id,
        data,
      })
      .onConflict("id", "replace"),
  ],
  "v1.ChatStreamFinished": ({ data, totalTokens, status, updatedAt }) => [
    tables.task
      .update({
        totalTokens,
        status,
        updatedAt,
        // Clear error if the stream is finished
        error: null,
      })
      .where({ id: "default" }),
    tables.messages
      .insert({
        id: data.id,
        data,
      })
      .onConflict("id", "replace"),
  ],
  "v1.ChatStreamFailed": ({ error, updatedAt }) =>
    tables.task
      .update({
        status: "failed",
        error,
        updatedAt,
      })
      .where({ id: "default" }),
});

const state = State.SQLite.makeState({ tables, materializers });

export const schema = makeSchema({ events, state });
