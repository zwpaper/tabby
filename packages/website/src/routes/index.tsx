import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { UserButton } from "@/components/user-button";
import { apiClient } from "@/lib/auth-client";
import { useEnhancingPrompt } from "@/lib/useEnhancingPrompt";
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
import type { KeyboardEvent } from "react";
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
  const { enhancePrompt, isPending: isEnhancing } = useEnhancingPrompt();

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

  const submitIsDisabled = isEnhancing || isSubmitting || inputValue.length < 8;

  const handleEnhance = async () => {
    if (!inputValue.trim()) return;
    if (auth === null) {
      setShowAuthDialog(true);
      return;
    }

    const enhanced = await enhancePrompt(inputValue);

    setInputValue(enhanced);
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
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
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : "An unknown error occurred",
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const submitOnEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-gradient-to-br from-white via-gray-100 to-gray-200 p-4 text-black">
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
      <h1 className="mt-[25vh] mb-12 flex gap-4 font-bold text-3xl tracking-tight md:text-5xl">
        <Terminal className="hidden size-12 animate-[spin_6s_linear_infinite] md:block" />
        What can I help you ship?
      </h1>
      <form
        className="w-full max-w-3xl rounded-lg border border-gray-300/50 bg-white/80 p-6 shadow-lg backdrop-blur-sm"
        onSubmit={handleSubmit}
      >
        <Textarea
          disabled={isSubmitting}
          onKeyDown={submitOnEnter}
          placeholder="Ask pochi to build..."
          className="mb-4 min-h-10 w-full resize-none border-none bg-transparent text-black text-lg placeholder-gray-400 shadow-none focus-visible:ring-0"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <div className="flex justify-end">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-gray-500 transition-colors hover:bg-gray-200/50 hover:text-black"
              onClick={handleEnhance}
              disabled={isEnhancing || !inputValue.trim()}
            >
              {isEnhancing ? (
                <Loader2Icon className="h-5 w-5 animate-spin" />
              ) : (
                <SparklesIcon className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-gray-500 transition-colors hover:bg-gray-200/50 hover:text-black"
            >
              <PaperclipIcon className="h-5 w-5" />
            </Button>
            <Button
              type="submit"
              disabled={submitIsDisabled}
              variant="default"
              size="icon"
              className="rounded-full transition-colors"
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
        <p className="mt-4 text-right text-destructive text-sm">
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
