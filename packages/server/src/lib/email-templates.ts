import { SocialLinks } from "@ragdoll/common";
import magicLinkEmail from "../templates/magic-link-email.html" with {
  type: "text",
};
import organizationInviteEmail from "../templates/organization-invite-email.html" with {
  type: "text",
};
import waitlistApprovalEmail from "../templates/waitlist-approval-email.html" with {
  type: "text",
};
import waitlistConfirmationPage from "../templates/waitlist-confirmation-page.html" with {
  type: "text",
};
import waitlistSignupEmail from "../templates/waitlist-signup-email.html" with {
  type: "text",
};
import welcomeEmail from "../templates/welcome-email.html" with {
  type: "text",
};

export interface MagicLinkEmailData {
  magicLinkUrl: string;
}

export interface OrganizationInviteEmailData {
  organizationName: string;
  inviteeName?: string;
  inviterName: string;
  inviterEmail: string;
  memberRole: string;
  acceptInviteUrl: string;
}

export interface WaitlistApprovalEmailData {
  userName?: string;
}

export interface WaitlistSignupEmailData {
  loginUrl: string;
}

export interface WaitlistConfirmationPageData {
  userInitial: string;
}

export interface WelcomeEmailData {
  userName?: string;
}

export function getMagicLinkEmailHtml(data: MagicLinkEmailData): string {
  return magicLinkEmail
    .replace("{{MAGIC_LINK_URL}}", data.magicLinkUrl)
    .replace(/{{DISCORD_URL}}/g, SocialLinks.Discord)
    .replace("{{X_URL}}", SocialLinks.X);
}

export function getOrganizationInviteEmailHtml(
  data: OrganizationInviteEmailData,
): string {
  return organizationInviteEmail
    .replace(/{{ORGANIZATION_NAME}}/g, data.organizationName)
    .replace("{{INVITEE_NAME}}", data.inviteeName ? ` ${data.inviteeName}` : "")
    .replace(/{{INVITER_NAME}}/g, data.inviterName)
    .replace(/{{INVITER_EMAIL}}/g, data.inviterEmail)
    .replace("{{MEMBER_ROLE}}", data.memberRole)
    .replace("{{ACCEPT_INVITE_URL}}", data.acceptInviteUrl)
    .replace("{{DISCORD_URL}}", SocialLinks.Discord);
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

export function getWelcomeEmailHtml(data: WelcomeEmailData): string {
  return welcomeEmail
    .replace("{{USER_NAME}}", data.userName ? `, ${data.userName}` : "")
    .replace(/{{DISCORD_URL}}/g, SocialLinks.Discord)
    .replace("{{X_URL}}", SocialLinks.X);
}
