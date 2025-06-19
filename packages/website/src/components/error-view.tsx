import {
  ClientError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/error";
import { cn } from "@/lib/utils";
import {
  type ErrorComponentProps,
  Link,
  type NotFoundRouteProps,
} from "@tanstack/react-router";

/**
 * Used by TanStack Router as the not found component.
 */
export function NotFoundComponent({
  className,
}: NotFoundRouteProps & { className?: string }) {
  return <NotFoundErrorView className={className} />;
}

/**
 * Used by TanStack Router as the error component.
 */
export function ErrorComponent({
  error,
  className,
}: ErrorComponentProps & { className?: string }) {
  if (error instanceof NotFoundError) {
    return <NotFoundErrorView className={className} />;
  }
  if (error instanceof UnauthorizedError) {
    return <UnauthorizedErrorView className={className} />;
  }
  if (error instanceof ForbiddenError) {
    return <ForbiddenErrorView className={className} />;
  }
  if (error instanceof InternalServerError) {
    return <InternalServerErrorView className={className} />;
  }

  if (error instanceof ClientError) {
    return <ClientErrorView error={error} className={className} />;
  }

  return (
    <ErrorDisplay
      className={className}
      title="Oops!"
      description="Sorry, an unexpected error has occurred."
    >
      {error?.message && (
        <p className="text-destructive text-sm">
          <i>{error.message}</i>
        </p>
      )}
    </ErrorDisplay>
  );
}

function NotFoundErrorView({ className }: { className?: string }) {
  return (
    <ErrorDisplay
      className={className}
      title="404"
      description="Oops, it looks like the page you're looking for doesn't exist."
    />
  );
}

function ForbiddenErrorView({ className }: { className?: string }) {
  return (
    <ErrorDisplay
      className={className}
      title="403"
      description="Oops, you don't have permission to access this page."
    />
  );
}

function UnauthorizedErrorView({ className }: { className?: string }) {
  return (
    <ErrorDisplay
      className={className}
      title="Unauthorized"
      description="Please sign in to view this page."
    />
  );
}

/**
 * For internal server errors, do not display the specific error message to the user.
 */
function InternalServerErrorView({ className }: { className?: string }) {
  return (
    <ErrorDisplay
      className={className}
      title="Something went wrong"
      description="This might be a temporary issue. Please try again later."
    />
  );
}

function ClientErrorView({
  className,
  error,
}: {
  className?: string;
  error?: ClientError;
}) {
  const { title, description } = getClientErrorDetails(error?.cause);

  return (
    <ErrorDisplay className={className} title={title} description={description}>
      {error?.message && (
        <p className="text-destructive text-sm">
          <i>{error.message}</i>
        </p>
      )}
    </ErrorDisplay>
  );
}

interface ErrorDisplayProps {
  className?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}

function ErrorDisplay({
  className,
  title,
  description,
  children,
}: ErrorDisplayProps) {
  return (
    <div
      className={cn(
        "relative mt-[200px] flex flex-col items-center justify-center",
        className,
      )}
    >
      <div className="flex flex-1 flex-col items-center justify-center space-y-4 px-10 text-center">
        <h1 className="font-bold text-4xl">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        {children}
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

function getClientErrorDetails(cause: ClientError["cause"] = "unknown") {
  switch (cause) {
    case "syntax":
      return {
        title: "Something went wrong",
        description: "This might be a temporary issue. Please try again later.",
      };
    case "network":
      return {
        title: "Network Error",
        description: "Oops, something went wrong with the network.",
      };
    case "aborted":
      return {
        title: "Failed to Fetch",
        description: "The request was cancelled. Please try again.",
      };
    default:
      return {
        title: "Failed to Fetch",
        description: "This might be a temporary issue. Please try again later.",
      };
  }
}
