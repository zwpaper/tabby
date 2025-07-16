import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('monthlyOrganizationUsage')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('organizationId', 'text', col => col.notNull())
    .addColumn('userId', 'text', col => col.notNull())
    .addColumn('modelId', 'text', col => col.notNull())
    // Stores the first day of the month (e.g., '2025-01-01 00:00:00')
    .addColumn('startDayOfMonth', 'timestamptz', col => col.notNull())
    // Added count column to track number of completions/calls
    .addColumn('count', 'integer', col => col.notNull().defaultTo(0))
    // Added credit column
    .addColumn('credit', 'integer', col => col.notNull().defaultTo(0))
    // Unique constraint for organization, startDayOfMonth (timestamp), and modelId
    .addUniqueConstraint('monthly_org_usage_org_userId_month_model_unique', [
      'organizationId',
      'userId',
      'startDayOfMonth',
      'modelId',
    ])
    .execute()


    // monthlyOrganizationCreditLimit
    await db.schema
      .createTable("monthlyOrganizationCreditLimit")
      .ifNotExists()
      .addColumn("id", "serial", (col) => col.primaryKey())
      .addColumn('createdAt', 'timestamptz', col =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
      )
      .addColumn('updatedAt', 'timestamptz', col =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
      )
      .addColumn("organizationId", "text", (col) =>
        col.references("organization.id").onDelete("cascade").notNull(),
      )
      .addColumn("limit", "integer", (col) => col.notNull())
      .addUniqueConstraint("monthly_credit_limit_organizationId_unique", ["organizationId"])
      .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('monthlyOrganizationUsage').ifExists().execute();
  await db.schema.dropTable("monthlyOrganizationCreditLimit").ifExists().execute();
}
