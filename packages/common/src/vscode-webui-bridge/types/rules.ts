export interface RuleFile {
  /**
   * rule file path, absolute path
   */
  filepath: string;
  /**
   * file path relative to the workspace root
   */
  relativeFilepath?: string;
  /**
   * Readable label for the file, used in UI
   */
  label?: string;
}
