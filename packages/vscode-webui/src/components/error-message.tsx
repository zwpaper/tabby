import { useIsDevMode } from "@/features/settings";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";

interface ErrorMessageProps {
  error: Error | undefined;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => {
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
        {error.message}
      </ScrollArea>
    )
  );
};
