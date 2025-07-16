import { createFileRoute } from "@tanstack/react-router";

import { CreateTeamForm } from "@/components/team/create-team-form";
import { JoinTeamView } from "@/components/team/join-team-view";
import { TeamView } from "@/components/team/team-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/_base/team")({
  component: TeamComponent,
});

function TeamComponent() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["organization"],
    queryFn: () => {
      return authClient.organization.getFullOrganization();
    },
  });
  const organization = data?.data;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8">
        <div className="flex items-center gap-4">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="my-8 space-y-4">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="my-8 space-y-4">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="container mx-auto max-w-2xl space-y-8 px-4 py-8 lg:px-8">
        <Tabs defaultValue="create">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create a Team</TabsTrigger>
            <TabsTrigger value="join">Join a Team</TabsTrigger>
          </TabsList>
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Create a new Team</CardTitle>
              </CardHeader>
              <CardContent>
                <CreateTeamForm onCreated={refetch} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="join">
            <Card>
              <CardHeader>
                <CardTitle>Join an existing Team</CardTitle>
              </CardHeader>
              <CardContent>
                <JoinTeamView />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // @ts-ignore FIXME
  return <TeamView organization={organization} />;
}
