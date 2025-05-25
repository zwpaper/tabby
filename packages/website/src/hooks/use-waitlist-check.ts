import { type User, authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Checks if a user is approved for waitlist access
 * @param user - The user object to check
 * @returns true if user is waitlist approved or is a tabbyml.com employee
 */
function isUserWaitlistApproved(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.isWaitlistApproved || user.email.endsWith("@tabbyml.com");
}

/**
 * Custom hook that monitors waitlist approval status with fresh session data
 * and automatically redirects to waitlist page if user is not approved
 */
export function useWaitlistCheck() {
  const { data } = useQuery({
    queryKey: ["freshSession"],
    queryFn: () =>
      authClient.getSession({
        query: {
          disableCookieCache: true,
        },
        fetchOptions: {
          throw: true,
        },
      }),
  });

  useEffect(() => {
    // Check if we need to redirect based on fresh session data
    if (data?.user && !isUserWaitlistApproved(data.user)) {
      // Force a redirect to waitlist if the fresh session shows user is not approved
      window.location.href = "/waitlist";
    }
  }, [data]);
}
