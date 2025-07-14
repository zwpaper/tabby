interface FileControlsProps {
  onImport: () => void;
  onExport: () => void;
  isExportDisabled: boolean;
}

export function FileControls({
  onImport,
  onExport,
  isExportDisabled,
}: FileControlsProps) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onImport}
        className="rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 text-sm shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Import from Clipboard
      </button>
      <button
        type="button"
        onClick={onExport}
        disabled={isExportDisabled}
        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Export to Clipboard
      </button>
    </div>
  );
}
