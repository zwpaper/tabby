import { Schema, queryDb, sql } from "@livestore/livestore";

export const messageSeq = (id: string) =>
  queryDb({
    query: sql`
  SELECT coalesce(
    (SELECT seq FROM messages WHERE id = ?),
    COALESCE(MAX(seq), 0) + 1
  ) as seq
  FROM messages
`,
    schema: Schema.Struct({ seq: Schema.Number }).pipe(
      Schema.pluck("seq"),
      Schema.Array,
      Schema.headOrElse(),
    ),
    bindValues: [id],
  });
