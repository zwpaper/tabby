import { getLogger } from "@ragdoll/common";
import { sql } from "kysely";
import cron from "node-cron";
import { db } from "../../db";
const ExpirationDays = 14;

const logger = getLogger("InactiveUserDisapproval");

interface InactiveUser {
  id: string;
  email: string;
  name: string;
  lastActivity: Date | null;
}

// Clean up inactive waitlist approvals by checking chatCompletions table
export async function disapproveInactiveUsers() {
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

// Start the scheduler - runs every 15 minutes
export function startDisapproveInactiveUsersScheduler() {
  cron.schedule("*/15 * * * *", async () => {
    logger.debug("Running 15-minute inactive user disapproval check...");
    try {
      await disapproveInactiveUsers();
    } catch (error) {
      logger.error("Error occurred during inactive user disapproval:", error);
    }
  });
}
