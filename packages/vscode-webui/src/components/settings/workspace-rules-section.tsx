import { FileList } from "@/components/tool-invocation/file-list";
import { Button, buttonVariants } from "@/components/ui/button";
import { useThirdPartyRules } from "@/lib/hooks/use-third-party-rules";
import { vscodeHost } from "@/lib/vscode";
import { Download, Loader2 } from "lucide-react";
import { Section } from "./section";

export const WorkspaceRulesSection: React.FC = () => {
  const { rulePaths, importThirdPartyRules, isImporting, workspaceRuleExists } =
    useThirdPartyRules();

  const hasThirdPartyRules = rulePaths.length > 0;

  const importRules = async () => {
    await importThirdPartyRules();
    vscodeHost.capture({
      event: "importThirdPartyRules",
      properties: {
        rulePaths,
      },
    });
  };

  return (
    <Section title="Rules">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <a
            href="command:ragdoll.editWorkspaceRules"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "secondary" })}
          >
            Edit Rules
          </a>
          <span className="text-muted-foreground text-sm">
            Customize rules for Pochi in this workspace.
          </span>
        </div>

        {/* Cursor Rules Status Section - Only show if detecting or rules found */}
        {!workspaceRuleExists && hasThirdPartyRules && (
          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-medium text-sm">Import Rules</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Found {rulePaths.length} rules
                  {rulePaths.length === 1 ? "" : "s"}
                </span>
                <Button
                  onClick={importRules}
                  disabled={isImporting}
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                >
                  {(() => {
                    if (isImporting) {
                      return (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          Importing...
                        </>
                      );
                    }

                    return (
                      <>
                        <Download className="mr-1 size-3" />
                        Import
                      </>
                    );
                  })()}
                </Button>
              </div>
              <FileList matches={rulePaths.map((path) => ({ file: path }))} />
            </div>
          </div>
        )}
      </div>
    </Section>
  );
};
