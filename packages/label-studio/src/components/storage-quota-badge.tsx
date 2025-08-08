import { AlertTriangle } from "lucide-react";

interface StorageQuotaBadgeProps {
  isVisible: boolean;
}

export function StorageQuotaBadge({ isVisible }: StorageQuotaBadgeProps) {
  if (!isVisible) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-red-200 bg-muted/50 px-3 py-2 text-red-800 text-sm shadow-sm">
      <AlertTriangle className="h-4 w-4" />
      <span className="font-medium">
        Storage limit exceeded - Data may be lost on refresh
      </span>
    </div>
  );
}
