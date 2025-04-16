import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  // First create the task_status enum type
  await db.schema
    .createType("task_status")
    .asEnum(["streaming", "pending", "completed", "failed"])
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
    .addColumn("status", sql`task_status`, (cb) => cb.notNull().defaultTo("pending"))
    .addColumn("environment", "jsonb", (cb) => cb.notNull().defaultTo("{}"))
    // Event that triggered the task, optional
    .addColumn("event", "jsonb")
    .addColumn("messages", "jsonb", (cb) => cb.notNull().defaultTo("[]"))
    .addForeignKeyConstraint("task_userId_fk", ["userId"], "user", ["id"])
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable("task").execute();
  
  // Then drop the enum type
  await db.schema.dropType("task_status").execute();
}