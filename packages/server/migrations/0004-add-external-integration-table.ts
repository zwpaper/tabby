import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("externalIntegration")
    .addColumn("id", "serial", (cb) => cb.primaryKey())
    .addColumn("createdAt", "timestamp", (cb) =>
      cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn("updatedAt", "timestamp", (cb) =>
      cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    // Assuming user.id is text based on 0002-track-usage.ts and 0001-better-auth.sql
    .addColumn("userId", "text", (cb) => cb.notNull()) 

    .addColumn("provider", "text", (cb) => cb.notNull()) // e.g., 'github', 'gitlab', 'slack'

    // Used to dedupe integrations, e.g., slack integration with the same vendorIntegrationId should be considered the same integration
    .addColumn("vendorIntegrationId", "text", (cb) => cb.notNull())

    .addColumn("payload", "jsonb", (cb) => cb.notNull()) // Store payload used for integration, it's schema depends on provider, but usually it shall contains accessToken, refreshToken, etc.

    .addForeignKeyConstraint("userId_fk", ["userId"], "user", ["id"]) 
    .addUniqueConstraint("provider_vendorIntegrationId_unique", ["provider", "vendorIntegrationId"])
    .execute();

  // Create an index on the payload JSONB column
  await db.schema
    .createIndex('externalIntegration_payload_idx')
    .on('externalIntegration')
    .column('payload')
    .execute();
}

export async function down(db: Kysely<any>) {
  // Drop the index on the payload JSONB column
  await db.schema.dropIndex('externalIntegration_payload_idx').execute();
  await db.schema.dropTable("externalIntegration").execute();
}
