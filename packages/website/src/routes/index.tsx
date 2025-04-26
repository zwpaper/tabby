import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UserButton } from "@/components/user-button";
import { apiClient } from "@/lib/auth-client";
import { AuthCard } from "@daveyplate/better-auth-ui";
import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";
import {
  ArrowUpIcon,
  Loader2Icon,
  PaperclipIcon,
  SparklesIcon,
  Terminal,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { z } from "zod";

const searchSchema = z.object({
  input: z.string().optional(),
});

export const Route = createFileRoute("/")({
  component: RouteComponent,
  validateSearch: (search) => searchSchema.parse(search),
});

function RouteComponent() {
  const { auth } = Route.useRouteContext();
  const search = useSearch({ from: Route.fullPath });

  const [inputValue, setInputValue] = useState(() => {
    if (search.input) {
      try {
        return decodeURIComponent(search.input);
      } catch (e) {
        return search.input;
      }
    }
    return "";
  });

  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { navigate } = useRouter();

  const submitIsDisabled = isSubmitting || inputValue.length < 8;
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitIsDisabled) return;

    setSubmitError(null);

    if (auth === null) {
      setShowAuthDialog(true);
    } else {
      setIsSubmitting(true);
      try {
        const res = await apiClient.api.tasks.$post({
          json: { prompt: inputValue },
        });

        if (!res.ok) {
          throw new Error(res.statusText || "Failed to create task");
        }

        const { id } = await res.json();
        navigate({
          to: "/tasks/$id/redirect",
          params: { id: id.toString() },
        });
        setInputValue("");
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : "An unknown error occurred",
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };
  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-white via-gray-100 to-gray-200 text-black p-4 relative">
      <div className="absolute top-10 right-10">
        <UserButton
          size="icon"
          classNames={{
            content: {
              base: "mr-10",
            },
            base: "border-2",
            trigger: {
              avatar: {
                base: "transition-transform duration-300 hover:scale-110 hover:rotate-3",
              },
            },
          }}
        />
      </div>
      <h1 className="mt-[25vh] text-3xl md:text-5xl font-bold mb-12 tracking-tight flex gap-4">
        <Terminal className="size-12 animate-[spin_6s_linear_infinite] hidden md:block" />
        What can I help you ship?
      </h1>
      <form
        className="w-full max-w-3xl bg-white/80 backdrop-blur-sm rounded-lg p-6 border border-gray-300/50 shadow-lg"
        onSubmit={handleSubmit}
      >
        <Input
          placeholder="Ask pochi to build..."
          className="w-full bg-transparent border-none text-black placeholder-gray-400 focus-visible:ring-0 text-lg mb-4 shadow-none"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <div className="flex justify-end">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:text-black hover:bg-gray-200/50 transition-colors rounded-full"
            >
              <SparklesIcon className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:text-black hover:bg-gray-200/50 transition-colors rounded-full"
            >
              <PaperclipIcon className="h-5 w-5" />
            </Button>
            <Button
              type="submit"
              disabled={submitIsDisabled}
              variant="default"
              size="icon"
              className="transition-colors rounded-full"
            >
              {isSubmitting ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <ArrowUpIcon />
              )}
            </Button>
          </div>
        </div>
      </form>
      {submitError && (
        <p className="text-destructive mt-4 text-sm text-right">
          {submitError}
        </p>
      )}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <AuthCard
            className="border-none shadow-none ring-none"
            callbackURL={
              inputValue
                ? `/?input=${encodeURIComponent(inputValue)}`
                : undefined
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
