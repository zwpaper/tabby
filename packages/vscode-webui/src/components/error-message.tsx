import { useIsDevMode } from "@/lib/hooks/use-is-dev-mode";
import { cn } from "@/lib/utils";

interface ErrorMessageProps {
  error: Error | undefined;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => {
  const [isDevMode] = useIsDevMode();
  return (
    error && (
      <div
        className={cn("mb-2 text-center text-red-500 dark:text-red-400", {
          "cursor-help": isDevMode,
        })}
        onClick={isDevMode ? () => console.error(error) : undefined}
      >
        {error.message}
      </div>
    )
  );
};
