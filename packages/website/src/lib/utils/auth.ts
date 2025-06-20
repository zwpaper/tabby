import type { User } from "@/lib/auth-client";

/**
 * Checks if a user is a TabbyML employee.
 * @param user The user object to check.
 * @returns true if the user is a TabbyML employee.
 */
export function isTabbyEmployee(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.email.endsWith("@tabbyml.com");
}
