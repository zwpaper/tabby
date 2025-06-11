export const EditSummary: React.FC<{
  editSummary: { added: number; removed: number };
}> = ({ editSummary }) => {
  return (
    <span className="mx-1">
      <span className="ml-1 text-[var(--vscode-editorGutter-addedBackground)]">
        +{editSummary.added}
      </span>
      <span className="ml-1 text-[var(--vscode-editorGutter-deletedBackground)]">
        -{editSummary.removed}
      </span>
    </span>
  );
};
