import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Hourglass, LifeBuoy, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

const searchSchema = z.object({
  uid: z.string().optional(),
  minionId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/redirect-remote")({
  validateSearch: (search) => searchSchema.parse(search),
  component: RouteComponent,
});

function RouteComponent() {
  const { uid, minionId } = Route.useSearch();
  const [isSlowRedirection, setIsSlowRedirection] = useState(false);

  const { data: task } = useQuery({
    queryKey: ["task", uid],
    queryFn: async () => {
      if (!uid) return null;
      const resp = await apiClient.api.tasks[":uid"].$get({
        param: { uid },
      });
      return resp.json();
    },
    enabled: !!uid,
  });

  const { data: redirectUrl } = useQuery({
    queryKey: ["minion-redirect-url", minionId],
    queryFn: async () => {
      if (!minionId) return null;
      const controller = new AbortController();
      // 10 seconds timeout
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await apiClient.api.minions[":id"][
          "redirect-url"
        ].$get(
          { param: { id: minionId } },
          { init: { signal: controller.signal } },
        );

        if (response.ok) {
          const url = await response.text();
          if (url) {
            return url;
          }
        }
        return null;
      } catch (error) {
        return null;
      } finally {
        // IMPORTANT: Always clear the timeout to prevent it from firing after the promise has settled
        clearTimeout(timeoutId);
      }
    },
    refetchInterval: 2000,
    enabled: !!minionId,
  });

  useEffect(() => {
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  }, [redirectUrl]);

  const description = useMemo(() => {
    if (task?.event?.type === "website:new-project") {
      return task.event.data.prompt?.split("\n")[0];
    }
    return null;
  }, [task]);

  useEffect(() => {
    const manualButtonTimeout = setTimeout(() => {
      setIsSlowRedirection(true);
    }, 8000);

    return () => {
      clearTimeout(manualButtonTimeout);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center text-center">
          <CardTitle className="flex items-center justify-center gap-1">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Starting {uid ? "Task" : ""}</span>
          </CardTitle>
          <CardDescription className="mt-1 text-xs italic">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {isSlowRedirection && (
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Hourglass className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <p>
                Hang tight, we're almost there! Setting up your development
                environment.
              </p>
            </div>
          )}
          <div className="flex items-start gap-3 rounded-md border p-3">
            <LifeBuoy className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
            <p>
              Need help? Check our documentation or contact support for
              assistance.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-md border border-destructive/20 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
            <div>
              <p>
                Do not share the development environment with untrusted parties.
                This environment contains your login credentials, GitHub access
                tokens, and other sensitive information.
              </p>
            </div>
          </div>
        </CardContent>
        {redirectUrl && (
          <CardFooter className="flex items-center justify-center">
            <p className="mb-2 text-muted-foreground text-xs">
              If task doesn't open automatically, click{" "}
              <a
                href={redirectUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                here
              </a>
            </p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
