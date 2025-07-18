import { authClient } from "@/lib/auth-client";
import { getBetterAuthErrorMessage } from "@/lib/error";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { Organization } from "better-auth/plugins";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { OrganizationView } from "./organization-view";

interface DeleteTeamCardProps {
  organization: Organization;
}

export function DeleteTeamCard({ organization }: DeleteTeamCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { refetch: refetchActiveOrganization } =
    authClient.useActiveOrganization();
  const [slugConfirmation, setSlugConfirmation] = useState("");

  const deleteTeamMutation = useMutation({
    mutationFn: async () => {
      await authClient.organization.delete({
        organizationId: organization.id,
        fetchOptions: {
          throw: true,
        },
      });
    },
    onSuccess: async () => {
      await authClient.organization.setActive({
        organizationId: null,
      });
      refetchActiveOrganization();
      // Invalidate the active organization query.
      // Invalidate both the active organization and the main session queries.
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "activeOrganization",
      });
      queryClient.invalidateQueries({
        queryKey: ["session"],
      });
      toast.success("Successfully deleted the team.");
      router.navigate({ to: "/" });
    },
    onError: (error) => {
      const errorReason = getBetterAuthErrorMessage(error);
      toast.error(`Failed to delete team: ${errorReason}`);
    },
  });

  const isSlugMatching = slugConfirmation === organization.slug;

  return (
    <Card className="rounded-sm border border-destructive/40 bg-card p-0 text-card-foreground shadow-sm">
      <CardContent className="space-y-6 p-0 pt-4">
        <div className="space-y-2 px-4">
          <CardTitle className="font-semibold text-base text-foreground">
            Delete Team
          </CardTitle>
          <CardDescription className="text-muted-foreground text-xs">
            Permanently remove your team and all of its contents. This action is
            not reversible — please continue with caution.
          </CardDescription>
        </div>
        <CardFooter className="!py-3 justify-center border-destructive/30 border-t bg-destructive/15 px-4 md:justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={deleteTeamMutation.isPending}
              >
                Delete Team
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Team</AlertDialogTitle>
                <AlertDialogDescription>
                  Permanently remove your team and all of its contents. This
                  action is not reversible — please continue with caution.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <OrganizationView organization={organization} />
                <div className="space-y-2">
                  <p className="font-medium text-sm">
                    Enter the team slug to continue:{" "}
                    <span className="font-semibold text-foreground">
                      {organization.slug}
                    </span>
                  </p>
                  <Input
                    value={slugConfirmation}
                    onChange={(e) => setSlugConfirmation(e.target.value)}
                    placeholder="Your team's slug"
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!isSlugMatching || deleteTeamMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!isSlugMatching || deleteTeamMutation.isPending) {
                      return;
                    }
                    deleteTeamMutation.mutate();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteTeamMutation.isPending ? "Deleting..." : "Delete Team"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </CardContent>
    </Card>
  );
}
