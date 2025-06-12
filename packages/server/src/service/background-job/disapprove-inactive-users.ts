import { getLogger } from "@ragdoll/common";
import { Queue, Worker } from "bullmq";
import { sql } from "kysely";
import { db } from "../../db";
import { queueConfig } from "./redis";

const ExpirationDays = 14;

const logger = getLogger("InactiveUserDisapproval");

interface InactiveUser {
  id: string;
  email: string;
  name: string;
  lastActivity: Date | null;
}

// Clean up inactive waitlist approvals by checking chatCompletions table
async function disapproveInactiveUsers() {
  return await db.transaction().execute(async (trx) => {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - ExpirationDays);

    // Find users who are approved but haven't had any chat completions in specified days
    const result = await sql<InactiveUser>`
      SELECT u.id, u.email, u.name, MAX(cc."createdAt") as "lastActivity"
      FROM "user" u
      LEFT JOIN "chatCompletion" cc ON u.id = cc."userId"
      WHERE u."isWaitlistApproved" = true
        AND u.email NOT LIKE '%@tabbyml.com'
        AND u."updatedAt" < ${expirationDate}
      GROUP BY u.id, u.email, u.name
      HAVING MAX(cc."createdAt") IS NULL OR MAX(cc."createdAt") < ${expirationDate}
    `.execute(trx);

    if (result.rows.length > 0) {
      // Update these users to remove waitlist approval
      const userIds = result.rows.map((user) => user.id);

      await sql`
        UPDATE "user" 
        SET "isWaitlistApproved" = false 
        WHERE id = ANY(${userIds})
      `.execute(trx);

      logger.info(
        `Expired waitlist approval for ${userIds.length} inactive users:`,
      );
    }

    return result.rows;
  });
}

const QueueName = "disapprove-inactive-users";

const queue = new Queue(QueueName, queueConfig);

await queue.upsertJobScheduler("every-15-minutes", {
  pattern: "*/15 * * * *",
});

export function createDisapproveInactiveUsersWorker() {
  return new Worker(
    QueueName,
    async () => {
      await disapproveInactiveUsers();
    },
    queueConfig,
  );
}
