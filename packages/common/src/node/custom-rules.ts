import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Collects custom rules from README.pochi.md and specified custom rule files.
 *
 * @param cwd Current working directory
 * @param customRuleFiles Array of paths to custom rule files (optional)
 * @param includeDefaultRules Whether to include the default README.pochi.md file (default: true)
 * @returns A string containing all collected rules, or empty string if no rules found
 */
export async function collectCustomRules(
  cwd: string,
  customRuleFiles: string[] = [],
  includeDefaultRules = true,
): Promise<string> {
  let rules = "";
  const allRuleFiles = [...customRuleFiles];

  // Add workspace rules file if requested
  if (includeDefaultRules) {
    const defaultRulesPath = path.join(cwd, "README.pochi.md");
    allRuleFiles.push(defaultRulesPath);
  }

  // Read all rule files
  for (const rulePath of allRuleFiles) {
    try {
      const content = await readFile(rulePath, "utf-8");
      if (content.trim().length > 0) {
        const relativePath = path.relative(cwd, rulePath);
        rules += `# Rules from ${relativePath}\n${content}\n`;
      }
    } catch {
      // Ignore files that can't be read
    }
  }

  return rules;
}
