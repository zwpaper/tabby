import { cn } from "@/lib/utils";
import {
  type ErrorComponentProps,
  Link,
  type NotFoundRouteProps,
} from "@tanstack/react-router";

interface NotFoundCompnentProps extends NotFoundRouteProps {
  className?: string;
}

export function NotFoundComponent({ className }: NotFoundCompnentProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center",
        className,
      )}
    >
      <div className="flex flex-1 flex-col items-center justify-center space-y-4 px-10 text-center">
        <h1 className="font-bold text-6xl">404</h1>
        <p className="text-muted-foreground">
          Oops, it looks like the page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Home
        </Link>
      </div>
    </div>
  );
}

export function ErrorComponent({
  error,
  className,
}: ErrorComponentProps & { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center",
        className,
      )}
    >
      <div className="flex flex-col items-center justify-center space-y-4 px-10 text-center">
        <h1 className="font-bold text-4xl">Oops!</h1>
        <p className="text-muted-foreground">
          Sorry, an unexpected error has occurred.
        </p>
        {
          // Display the error message if available
          error?.message && (
            <p className="text-destructive text-sm">
              <i>{error.message}</i>
            </p>
          )
        }
        <Link
          to="/"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          onClick={() => {
            // Optionally, you can try to clear the error state or reload
            // This depends on how your router handles errors
            // router.invalidate(); // Example if using TanStack Router's invalidate feature
          }}
        >
          Home
        </Link>
      </div>
    </div>
  );
}
