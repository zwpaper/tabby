import type { User } from "@/lib/auth-client";

/**
 * Checks if a user is a INternal user.
 * @param user The user object to check.
 */
export function isInternalUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.email.endsWith("@tabbyml.com") && user.emailVerified;
}
