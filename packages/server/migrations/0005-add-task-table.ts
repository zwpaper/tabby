import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("task")
    .addColumn("id", "serial", (cb) => cb.primaryKey())
    .addColumn("createdAt", "timestamptz", (cb) =>
      cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updatedAt", "timestamptz", (cb) =>
      cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("userId", "text", (cb) => cb.notNull())
    .addColumn("finishReason", "text", (cb) => cb.notNull().defaultTo("stop"))
    .addColumn("environment", "jsonb", (cb) => cb.notNull().defaultTo("{}"))
    // Event that triggered the task, optional
    .addColumn("event", "jsonb")
    .addColumn("messages", "jsonb", (cb) => cb.notNull().defaultTo("[]"))
    .addForeignKeyConstraint("task_userId_fk", ["userId"], "user", ["id"])
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable("task").execute();
}