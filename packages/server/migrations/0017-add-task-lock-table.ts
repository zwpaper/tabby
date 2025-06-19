import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("taskLock")
    .addColumn("id", "text", (cb) => cb.primaryKey())
    .addColumn("taskId", "integer", (cb) =>
      cb.references("task.id").onDelete("cascade").notNull().unique()
    )
    .addColumn("createdAt", "timestamptz", (cb) =>
      cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable("taskLock").ifExists().execute();
}

