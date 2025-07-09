import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createFileRoute } from "@tanstack/react-router";
import {
  Hourglass,
  LifeBuoy,
  Loader2,
  MessageCircleQuestion,
} from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

const searchSchema = z.object({
  url: z.string(),
});

export const Route = createFileRoute("/redirect-url")({
  validateSearch: (search) => searchSchema.parse(search),
  component: RouteComponent,
});

function RouteComponent() {
  const { url } = Route.useSearch();
  const [data, setData] = useState<{ url: string } | null>(null);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSlowRedirection, setIsSlowRedirection] = useState(false);
  useEffect(() => {
    if (!url) return;

    const fetchUrl = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const urlToFetch = `/api/redirect-minion?url=${encodeURIComponent(url)}`;
        const response = await fetch(urlToFetch, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch redirect URL: ${response.statusText}`,
          );
        }

        const body = await response.text();
        setData({ url: body });
      } catch (err) {
        setIsError(true);
        setError(err as Error);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    fetchUrl();
  }, [url]);

  useEffect(() => {
    const delay = 8000;

    const redirectTimeoutHandle = setTimeout(() => {
      setIsSlowRedirection(true);
    }, delay);

    return () => {
      clearTimeout(redirectTimeoutHandle);
    };
  }, []);

  useEffect(() => {
    if (data?.url) {
      window.location.href = data.url;
    }
  }, [data]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center text-center">
          <CardTitle className="flex items-center justify-center gap-1">
            {isError ? (
              <LifeBuoy className="size-4 text-destructive" />
            ) : (
              <Loader2 className="size-4 animate-spin text-primary" />
            )}
            <span>{isError ? "Error" : "Starting Task"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <>
            {isError && (
              <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive">
                <MessageCircleQuestion className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                <p>
                  {(error as Error)?.message || "An unknown error occurred."}
                </p>
              </div>
            )}
            {!isError && isSlowRedirection && (
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
                If you encounter issues, refer to the documentation or contact
                support.
              </p>
            </div>
          </>
        </CardContent>
        {data?.url && !isError && (
          <CardFooter className="flex items-center justify-center">
            <p className="mb-2 text-muted-foreground text-xs">
              If task doesn't open automatically, click{" "}
              <a
                href={data.url}
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
