import { authClient } from "@/lib/auth-client";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/stop-impersonating")({
  component: StopImpersonatingPage,
});

// Loading component while API call is in progress
function StopImpersonatingPage() {
  useEffect(() => {
    authClient.admin.stopImpersonating().then(() => {
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    });
  }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
    </div>
  );
}
