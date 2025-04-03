import type { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("dailyUsage")
    .addColumn("id", "serial", (cb) => cb.primaryKey())
    .addColumn("date", "date", (cb) => cb.notNull())
    .addColumn("userId", "text", (cb) => cb.notNull())
    .addColumn("promptTokens", "integer", (cb) => cb.notNull())
    .addColumn("completionTokens", "integer", (cb) => cb.notNull())
    .addForeignKeyConstraint("userId", ["userId"], "user", ["id"])
    .addUniqueConstraint("date_userId", ["date", "userId"])
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable("dailyUsage").execute();
}
