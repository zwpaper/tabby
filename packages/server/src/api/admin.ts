import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireAuth } from "../auth";
import { db } from "../db";
import { getWaitlistApprovalEmailHtml } from "../lib/email-templates";
import { resend } from "../lib/resend";

const admin = new Hono().post(
  "/approveWaitlist",
  zValidator(
    "query",
    z.object({
      userId: z.string(),
    }),
  ),
  requireAuth("admin"),
  async (c) => {
    const { userId } = c.req.valid("query");

    try {
      // First, get the user's email and current approval status
      const user = await db
        .selectFrom("user")
        .select(["id", "email", "name", "isWaitlistApproved"])
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!user) {
        throw new HTTPException(404, {
          message: "User not found",
        });
      }

      // Check if already approved
      if (user.isWaitlistApproved) {
        return c.json({
          message: `User ${userId} is already approved.`,
        });
      }

      // Update user to approved status
      const result = await db
        .updateTable("user")
        .set({ isWaitlistApproved: true })
        .where("id", "=", userId)
        .returning("id")
        .executeTakeFirst();

      if (!result) {
        throw new HTTPException(500, {
          message: "Failed to update user approval status",
        });
      }

      // Send welcome email
      try {
        const emailHtml = getWaitlistApprovalEmailHtml({
          userName: user.name,
        });

        await resend.emails.send({
          from: "Pochi <noreply@getpochi.com>",
          to: user.email,
          subject: "Welcome to Pochi - Your waitlist approval is confirmed!",
          html: emailHtml,
        });
      } catch (emailError) {
        // Log email error but don't fail the approval
        console.error("Failed to send welcome email:", emailError);
      }

      return c.json({
        message: `User ${userId} approved and welcome email sent.`,
      });
    } catch (error) {
      throw new HTTPException(500, {
        message: "Failed to approve user",
      });
    }
  },
);

export default admin;
