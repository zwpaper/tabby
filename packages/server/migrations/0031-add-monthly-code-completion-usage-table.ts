import { type Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("monthlyCodeCompletionUsage")
    .addColumn("id", "serial", (cb) => cb.primaryKey())
    .addColumn("userId", "text", (cb) => cb.notNull())
    // Stores the first day of the month (e.g., '2025-01-01 00:00:00')
    .addColumn("startDayOfMonth", "timestamptz", (cb) => cb.notNull())
    // Added count column to track number of code completion api calls
    .addColumn("count", "integer", (cb) => cb.notNull().defaultTo(0))
    .addForeignKeyConstraint("userId", ["userId"], "user", ["id"])
    // Unique constraint for user and startDayOfMonth (timestamp)
    .addUniqueConstraint("monthly_code_completion_usage_user_month_unique", [
      "userId",
      "startDayOfMonth",
    ])
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable("monthlyCodeCompletionUsage").execute();
}
