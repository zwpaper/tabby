import { authClient } from "@/lib/auth-client";
import { getBetterAuthErrorMessage } from "@/lib/error";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
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

interface LeaveTeamCardProps {
  organizationId: string;
  organizationSlug: string;
}

export function LeaveTeamCard({
  organizationId,
  organizationSlug,
}: LeaveTeamCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: organization, refetch: refetchActiveOrganization } =
    authClient.useActiveOrganization();

  const leaveTeamMutation = useMutation({
    mutationFn: async () => {
      await authClient.organization.leave({
        organizationId,
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
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "activeOrganization",
      });
      queryClient.invalidateQueries({
        queryKey: ["session"],
      });
      toast.success("Successfully left the team");
      router.navigate({ to: "/" });
    },
    onError: (error) => {
      const errorReason = getBetterAuthErrorMessage(error);
      toast.error(`Failed to leave team: ${errorReason}`);
    },
  });

  if (!organization) return null;

  return (
    <Card className="rounded-sm border border-destructive/40 bg-card p-0 text-card-foreground shadow-sm">
      <CardContent className="space-y-6 p-0 pt-4">
        <div className="space-y-2 px-4">
          <CardTitle className="font-semibold text-base text-foreground">
            Leave Team
          </CardTitle>
          <CardDescription className="text-muted-foreground text-xs">
            Remove yourself from this team. You will lose access to all team
            resources and data.
          </CardDescription>
        </div>
        <CardFooter className="!py-3 justify-center border-destructive/30 border-t bg-destructive/15 px-4 md:justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={leaveTeamMutation.isPending}
              >
                Leave Team
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave Team</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to leave the team{" "}
                  <span className="font-semibold">{organizationSlug}</span>?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={leaveTeamMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    if (leaveTeamMutation.isPending) {
                      return;
                    }

                    leaveTeamMutation.mutate();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {leaveTeamMutation.isPending ? "Leaving..." : "Leave Team"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </CardContent>
    </Card>
  );
}
