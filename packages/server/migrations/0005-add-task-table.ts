import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  // First create the task_status enum type
  await db.schema
    .createType("task_status")
    .asEnum(["streaming", "pending-tool", "pending-input", "completed", "failed"])
    .execute();

  await db.schema.createTable("taskSequence")
    .addColumn("id", "serial", (cb) => cb.primaryKey())
    .addColumn("nextTaskId", "integer", (cb) => cb.notNull().defaultTo(1))
    .addColumn("userId", "text", (cb) => cb.notNull())
    .addForeignKeyConstraint("taskSequence_userId_fk", ["userId"], "user", ["id"])
    .addUniqueConstraint("taskSequence_userId_unique", ["userId"])
    .execute();

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
    .addColumn("taskId", "integer", (cb) => cb.notNull())
    .addColumn("status", sql`task_status`, (cb) => cb.notNull().defaultTo("pending-input"))
    .addColumn("environment", "jsonb")
    // Event that triggered the task, optional
    .addColumn("event", "jsonb")
    .addColumn("conversation", "jsonb")
    .addForeignKeyConstraint("task_userId_fk", ["userId"], "user", ["id"])
    .addUniqueConstraint("task_userId_taskId_unique", ["userId", "taskId"])
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable("task").ifExists().execute();
  await db.schema.dropTable("taskSequence").ifExists().execute();
  await db.schema.dropType("task_status").ifExists().execute();
}