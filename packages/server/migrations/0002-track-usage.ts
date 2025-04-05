import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("chatCompletion")
    .addColumn("id", "serial", (cb) => cb.primaryKey())
    .addColumn("createdAt", "timestamp", (cb) => cb.notNull().defaultTo("now()"))
    .addColumn("modelId", "text", (cb) => cb.notNull())
    .addColumn("userId", "text", (cb) => cb.notNull())
    .addColumn("promptTokens", "integer", (cb) => cb.notNull())
    .addColumn("completionTokens", "integer", (cb) => cb.notNull())
    .addForeignKeyConstraint("userId", ["userId"], "user", ["id"])
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable("chatCompletion").execute();
}
