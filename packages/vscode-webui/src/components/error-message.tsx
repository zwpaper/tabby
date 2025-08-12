import { useIsDevMode } from "@/features/settings";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { ScrollArea } from "./ui/scroll-area";

interface ErrorMessageProps {
  error: { message: string } | undefined;
  formatter?: (e: { message: string }) => ReactNode;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  formatter,
}) => {
  const [isDevMode] = useIsDevMode();
  return (
    error && (
      <ScrollArea
        className={cn("mb-2 break-all text-center text-error", {
          "cursor-help": isDevMode,
        })}
        viewportClassname="max-h-32"
        onClick={isDevMode ? () => console.error(error) : undefined}
      >
        {formatter ? formatter(error) : error.message}
      </ScrollArea>
    )
  );
};
