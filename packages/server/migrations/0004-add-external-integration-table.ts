import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("externalIntegration")
    .addColumn("id", "serial", (cb) => cb.primaryKey())
    .addColumn("createdAt", "timestamptz", (cb) =>
      cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updatedAt", "timestamptz", (cb) =>
      cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    // Assuming user.id is text based on 0002-track-usage.ts and 0001-better-auth.sql
    .addColumn("userId", "text", (cb) => cb.notNull()) 
    .addColumn("vendorData", "jsonb", (cb) => cb.notNull()) // Store payload used for integration, it's schema depends on provider, but usually it shall contains accessToken, refreshToken, etc.
    .addForeignKeyConstraint("userId_fk", ["userId"], "user", ["id"]) 
    .execute();

  await db.schema.createIndex("vendorDataProvider_vendorDataIntegrationIdId_unique_idx")
  .unique()
  .on("externalIntegration")
  .expression(sql`("vendorData"->>'provider'), ("vendorData"->>'integrationId')`).execute();
}

export async function down(db: Kysely<any>) {
  // Drop the index on the payload JSONB column
  await db.schema.dropIndex('vendorDataProvider_vendorDataIntegrationIdId_unique_idx').execute();
  await db.schema.dropTable("externalIntegration").execute();
}
