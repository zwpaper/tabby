import { useRef } from "react";

interface FileControlsProps {
  onImport: () => void;
  onExport: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImportTasks: () => void;
  onImportSpanIds: () => void;
  isExportDisabled: boolean;
}

export function FileControls({
  onImport,
  onExport,
  onFileUpload,
  onImportTasks,
  onImportSpanIds,
  isExportDisabled,
}: FileControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onImport}
        className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 font-medium text-foreground text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
      >
        Import from Clipboard
      </button>
      <button
        type="button"
        onClick={handleUploadClick}
        className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 font-medium text-foreground text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
      >
        Upload File
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".jsonl,.txt"
        onChange={onFileUpload}
        className="hidden"
      />
      <button
        type="button"
        onClick={onImportTasks}
        className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 font-medium text-foreground text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
      >
        Import Tasks
      </button>
      <button
        type="button"
        onClick={onImportSpanIds}
        className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 font-medium text-foreground text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
      >
        Import Span IDs
      </button>
      <button
        type="button"
        onClick={onExport}
        disabled={isExportDisabled}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm shadow-sm transition-colors hover:bg-primary/90 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        Export to Clipboard
      </button>
    </div>
  );
}
