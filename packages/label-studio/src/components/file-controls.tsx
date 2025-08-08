import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Download, MoreHorizontal, Trash2, Upload } from "lucide-react";
import { useRef } from "react";

interface FileControlsProps {
  onImport: () => void;
  onExport: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImportTasks: () => void;
  onImportSpanIds: () => void;
  onExportShareLinks: () => void;
  onClearStorage: () => void;
  isExportDisabled: boolean;
}

export function FileControls({
  onImport,
  onExport,
  onFileUpload,
  onImportTasks,
  onImportSpanIds,
  onExportShareLinks,
  onClearStorage,
  isExportDisabled,
}: FileControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center gap-3">
      {/* Primary action - always visible */}
      <Button onClick={onImport} className="bg-primary hover:bg-primary/90">
        Import from Clipboard
      </Button>

      {/* Secondary actions in popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56" align="start">
          <div className="space-y-1">
            <div className="px-2 py-1.5 font-medium text-muted-foreground text-sm">
              Import Options
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleUploadClick}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import From File
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={onImportTasks}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Tasks
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={onImportSpanIds}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Span IDs
            </Button>

            <div className="my-1 border-t" />

            <div className="px-2 py-1.5 font-medium text-muted-foreground text-sm">
              Export Options
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={onExport}
              disabled={isExportDisabled}
            >
              <Download className="mr-2 h-4 w-4" />
              Export to Clipboard
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={onExportShareLinks}
              disabled={isExportDisabled}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Share Links
            </Button>

            <div className="my-1 border-t" />

            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={onClearStorage}
              disabled={isExportDisabled}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Storage
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jsonl,.txt"
        onChange={onFileUpload}
        className="hidden"
      />
    </div>
  );
}
