import waitlistApprovalEmail from "../templates/waitlist-approval-email.html" with {
  type: "text",
};

export interface WaitlistApprovalEmailData {
  userName?: string;
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
