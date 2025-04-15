import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("task")
    .addColumn("id", "serial", (cb) => cb.primaryKey())
    .addColumn("createdAt", "timestamp", (cb) =>
      cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updatedAt", "timestamp", (cb) =>
      cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("userId", "text", (cb) => cb.notNull())
    .addColumn("environment", "jsonb", (cb) => cb.notNull().defaultTo("{}"))
    .addColumn("messages", "jsonb", (cb) => cb.notNull().defaultTo("[]"))
    .addForeignKeyConstraint("task_userId_fk", ["userId"], "user", ["id"])
    .execute();

  // Create an index on the messages JSONB column
  await db.schema
    .createIndex('task_messages_idx')
    .on('task')
    .column('messages')
    .execute();
}

export async function down(db: Kysely<any>) {
  // Drop the index on the messages JSONB column
  await db.schema.dropIndex('task_messages_idx').execute();
  await db.schema.dropTable("task").execute();
}