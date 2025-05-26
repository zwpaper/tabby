import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import type { TaskStatus } from "../tasks/types";

export function getStatusIcon(status: TaskStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "streaming":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-500" />;
  }
}
