import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiClient } from "@/lib/auth-client";
import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, Loader2, Puzzle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/tasks/$id/redirect")({
  loader: async ({ params }) => {
    const resp = await apiClient.api.tasks[":id"].$get({
      param: {
        id: params.id.toString(),
      },
    });
    return resp.json();
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useLoaderData();
  const [showManualButton, setShowManualButton] = useState(false);

  const vscodeLink = `vscode://com.getpochi.vscode/?task=${id}`;
  const openVSCode = useCallback(() => {
    window.open(vscodeLink);
  }, [vscodeLink]);

  useEffect(() => {
    const redirectTimeoutHandle = setTimeout(openVSCode, 1000);
    const showButtonTimeoutHandle = setTimeout(
      () => setShowManualButton(true),
      1000,
    );

    return () => {
      clearTimeout(redirectTimeoutHandle);
      clearTimeout(showButtonTimeoutHandle);
    };
  }, [openVSCode]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center text-center">
          <CardTitle className="flex justify-center items-center gap-1">
            {!showManualButton && (
              <Loader2 className="size-4 animate-spin text-primary" />
            )}
            <span>Starting Task</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-start gap-3 rounded-md border p-3">
            <Puzzle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
            <p>Ensure the Pochi VS Code extension is installed.</p>
          </div>
          <div className="flex items-start gap-3 rounded-md border p-3">
            <LifeBuoy className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
            <p>
              If you encounter issues, refer to the documentation or contact
              support.
            </p>
          </div>
        </CardContent>
        {showManualButton && (
          <CardFooter className="flex justify-center items-center">
            <p className="text-xs text-muted-foreground mb-2">
              If VS Code doesn't open automatically, click{" "}
              <a
                href={vscodeLink}
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
