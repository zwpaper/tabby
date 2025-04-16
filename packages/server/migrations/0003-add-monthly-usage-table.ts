import { type Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("monthlyUsage")
    .addColumn("id", "serial", (cb) => cb.primaryKey())
    .addColumn("userId", "text", (cb) => cb.notNull())
    .addColumn("modelId", "text", (cb) => cb.notNull())
    // Stores the first day of the month (e.g., '2025-01-01 00:00:00')
    .addColumn("startDayOfMonth", "timestamptz", (cb) => cb.notNull())
    // Added count column to track number of completions/calls
    .addColumn("count", "integer", (cb) => cb.notNull().defaultTo(0))
    // Removed token columns
    .addForeignKeyConstraint("userId", ["userId"], "user", ["id"])
    // Unique constraint for user, startDayOfMonth (timestamp), and modelId
    .addUniqueConstraint("monthly_usage_user_month_model_unique", [
      "userId",
      "startDayOfMonth",
      "modelId",
    ])
    .execute();
}

export async function down(db: Kysely<any>) {
  // Then drop the table
  await db.schema.dropTable("monthlyUsage").execute();
}
