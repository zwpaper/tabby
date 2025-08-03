import { Schema, queryDb, sql } from "@livestore/livestore";
import { tables } from "./schema";

export const messageSeq$ = (taskId: string, id: string) =>
  queryDb({
    query: sql`
  SELECT coalesce(
    (SELECT seq FROM messages WHERE id = ?),
    COALESCE(MAX(seq), 0) + 1
  ) as seq
  FROM messages
  WHERE taskId = ?
`,
    schema: Schema.Struct({ seq: Schema.Number }).pipe(
      Schema.pluck("seq"),
      Schema.Array,
      Schema.headOrElse(),
    ),
    bindValues: [id, taskId],
  });

export const uiState$ = queryDb(tables.uiState.get(), { label: "uiState" });

export const messages$ = queryDb(
  (get) => {
    const { taskId = "" } = get(uiState$);
    return tables.messages.orderBy("seq", "asc").where("taskId", "=", taskId);
  },
  { label: "messages" },
);

export const tasks$ = queryDb(
  {
    query: sql`
    SELECT tasks.id as id,
           seq,
           JSON_EXTRACT(messages.data, '$.parts[0].text') as title
    FROM tasks LEFT JOIN messages ON (tasks.id = messages.taskId)
    WHERE (seq IS NULL) OR (seq = 1)
    `,
    schema: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        seq: Schema.NullOr(Schema.Number),
        title: Schema.NullOr(Schema.String),
      }),
    ),
  },
  { label: "tasks" },
);
