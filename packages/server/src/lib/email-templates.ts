import { SocialLinks } from "@ragdoll/common";
import waitlistApprovalEmail from "../templates/waitlist-approval-email.html" with {
  type: "text",
};
import waitlistConfirmationPage from "../templates/waitlist-confirmation-page.html" with {
  type: "text",
};
import waitlistSignupEmail from "../templates/waitlist-signup-email.html" with {
  type: "text",
};

export interface WaitlistApprovalEmailData {
  userName?: string;
}

export interface WaitlistSignupEmailData {
  loginUrl: string;
}

export interface WaitlistConfirmationPageData {
  userInitial: string;
}

export function getWaitlistApprovalEmailHtml(
  data: WaitlistApprovalEmailData,
): string {
  // Replace placeholders with actual data
  return waitlistApprovalEmail.replace(
    "{{USER_NAME}}",
    data.userName ? ` ${data.userName}` : "",
  );
}

export function getWaitlistSignupEmailHtml(
  data: WaitlistSignupEmailData,
): string {
  return waitlistSignupEmail
    .replace("{{LOGIN_URL}}", data.loginUrl)
    .replace(/{{DISCORD_URL}}/g, SocialLinks.Discord)
    .replace("{{X_URL}}", SocialLinks.X);
}

export function getWaitlistConfirmationPageHtml(
  data: WaitlistConfirmationPageData,
): string {
  return waitlistConfirmationPage
    .replace("{{USER_INITIAL}}", data.userInitial)
    .replace("{{DISCORD_URL}}", SocialLinks.Discord);
}
