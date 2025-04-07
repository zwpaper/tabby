import { Resend } from "resend";

export const resend = new Resend(
  process.env.RESEND_API_KEY || "RESEND_API_KEY is not set",
);
