import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { APIError } from "better-auth/api";
import { Loader2 } from "lucide-react"; // Import a spinner icon
import { useState } from "react";
import { toast } from "sonner"; // Import toast for notifications
import { z } from "zod";

// Define the expected search parameters schema
const deviceLinkSearchSchema = z.object({
  token: z.string(),
});

export const Route = createFileRoute("/_authenticated/auth/device-link")({
  loaderDeps({ search }: { search: z.infer<typeof deviceLinkSearchSchema> }) {
    return { ...search };
  },
  async loader({ deps: { token } }) {
    const { data, error } = await authClient.deviceLink.info({
      query: { token },
    });

    return {
      data: data instanceof APIError ? null : data,
      error: error?.message || (data instanceof APIError ? data.message : null),
    };
  },
  component: DeviceLinkConfirmationPage,
  validateSearch: (search) => deviceLinkSearchSchema.parse(search),
});

function DeviceLinkConfirmationPage() {
  const loaderData = Route.useLoaderData();
  const deviceName = loaderData.data?.deviceName ?? "Unknown Device";

  // Extract validated search parameters
  const { token } = useSearch({ from: Route.id });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(loaderData.error ?? null);
  const [isApproved, setIsApproved] = useState(false); // State to track approval success

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    setIsApproved(false); // Reset approval status
    try {
      const { error } = await authClient.deviceLink.approve({ token });
      if (error) {
        throw new Error(error.message);
      }
      setIsApproved(true); // Set approval success
      toast.success("Device sign-in approved successfully!");
      // Optionally redirect or update UI further upon success
    } catch (err) {
      console.error("Failed to approve device link:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Failed to approve sign-in: ${errorMessage}`);
      toast.error(`Failed to approve sign-in: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Confirm Device Sign-in</CardTitle>
          <CardDescription>
            A new device is attempting to sign in to your account. Please
            confirm if you initiated this sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Device:{" "}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {deviceName}
            </span>{" "}
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {isApproved && (
            <p className="text-sm text-green-600">
              Sign-in approved successfully. You can close this window.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          {!error &&
            !isApproved && ( // Only show button if not yet approved
              <Button onClick={handleConfirm} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  "Yes, Approve Sign-in"
                )}
              </Button>
            )}
        </CardFooter>
      </Card>
    </div>
  );
}
