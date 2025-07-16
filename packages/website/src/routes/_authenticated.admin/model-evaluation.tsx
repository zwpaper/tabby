import { useTheme } from "@/components/theme-provider";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/model-evaluation")({
  component: DataLabelingPage,
});

function DataLabelingPage() {
  const { theme } = useTheme();

  return (
    <div className="h-full overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
      <iframe
        src={`/data-labeling-tool/?theme=${theme}`}
        className="h-full w-full border-0"
        title="Data Labeling Tool"
      />
    </div>
  );
}
