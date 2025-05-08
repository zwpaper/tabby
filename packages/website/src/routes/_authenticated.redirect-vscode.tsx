import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, Loader2, Puzzle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

const searchSchema = z.object({
  prompt: z.string(),
});

export const Route = createFileRoute("/_authenticated/redirect-vscode")({
  validateSearch: (search) => searchSchema.parse(search),
  component: RouteComponent,
});

function RouteComponent() {
  const { prompt } = Route.useSearch();
  const [showManualButton, setShowManualButton] = useState(false);

  const vscodeLink = `vscode://TabbyML.pochi/?newProject=${encodeURIComponent(
    JSON.stringify({
      prompt,
      githubTemplateUrl:
        "https://github.com/wsxiaoys/reimagined-octo-funicular",
    }),
  )}`;

  const openVSCode = useCallback(() => {
    window.open(vscodeLink);
  }, [vscodeLink]);

  useEffect(() => {
    const redirectTimeoutHandle = setTimeout(() => {
      openVSCode();
      setShowManualButton(true);
    }, 1000);

    return () => {
      clearTimeout(redirectTimeoutHandle);
    };
  }, [openVSCode]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center text-center">
          <CardTitle className="flex items-center justify-center gap-1">
            {!showManualButton && (
              <Loader2 className="size-4 animate-spin text-primary" />
            )}
            <span>Starting Task</span>
          </CardTitle>
          <CardDescription className="mt-1 text-xs italic">
            {prompt}
          </CardDescription>
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
          <CardFooter className="flex items-center justify-center">
            <p className="mb-2 text-muted-foreground text-xs">
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
