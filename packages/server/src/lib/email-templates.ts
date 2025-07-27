import fs from "node:fs/promises";
import { SocialLinks } from "@ragdoll/common";

async function readHtml(name: string) {
  return fs.readFile(`./src/templates/${name}.html`, "utf8");
}
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

export async function getMagicLinkEmailHtml(
  data: MagicLinkEmailData,
): Promise<string> {
  const html = await readHtml("magic-link-email");
  return html
    .replace("{{MAGIC_LINK_URL}}", data.magicLinkUrl)
    .replace(/{{DISCORD_URL}}/g, SocialLinks.Discord)
    .replace("{{X_URL}}", SocialLinks.X);
}

export async function getOrganizationInviteEmailHtml(
  data: OrganizationInviteEmailData,
): Promise<string> {
  const html = await readHtml("organization-invite-email");
  return html
    .replace(/{{ORGANIZATION_NAME}}/g, data.organizationName)
    .replace("{{INVITEE_NAME}}", data.inviteeName ? ` ${data.inviteeName}` : "")
    .replace(/{{INVITER_NAME}}/g, data.inviterName)
    .replace(/{{INVITER_EMAIL}}/g, data.inviterEmail)
    .replace("{{MEMBER_ROLE}}", data.memberRole)
    .replace("{{ACCEPT_INVITE_URL}}", data.acceptInviteUrl)
    .replace("{{DISCORD_URL}}", SocialLinks.Discord);
}

export async function getWaitlistApprovalEmailHtml(
  data: WaitlistApprovalEmailData,
): Promise<string> {
  const html = await readHtml("waitlist-approval-email");
  return html.replace(
    "{{USER_NAME}}",
    data.userName ? ` ${data.userName}` : "",
  );
}

export async function getWaitlistSignupEmailHtml(
  data: WaitlistSignupEmailData,
): Promise<string> {
  const html = await readHtml("waitlist-signup-email");
  return html
    .replace("{{LOGIN_URL}}", data.loginUrl)
    .replace(/{{DISCORD_URL}}/g, SocialLinks.Discord)
    .replace("{{X_URL}}", SocialLinks.X);
}

export async function getWaitlistConfirmationPageHtml(
  data: WaitlistConfirmationPageData,
): Promise<string> {
  const html = await readHtml("waitlist-confirmation-page");
  return html
    .replace("{{USER_INITIAL}}", data.userInitial)
    .replace("{{DISCORD_URL}}", SocialLinks.Discord);
}

export async function getWelcomeEmailHtml(
  data: WelcomeEmailData,
): Promise<string> {
  const html = await readHtml("welcome-email");
  return html
    .replace("{{USER_NAME}}", data.userName ? `, ${data.userName}` : "")
    .replace(/{{DISCORD_URL}}/g, SocialLinks.Discord)
    .replace("{{X_URL}}", SocialLinks.X);
}
