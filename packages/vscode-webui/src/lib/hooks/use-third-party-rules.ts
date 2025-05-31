import { vscodeHost } from "@/lib/vscode";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useThirdPartyRules() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["thirdPartyRules"],
    queryFn: async () => {
      return await vscodeHost.fetchThirdPartyRules();
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      return await data?.copyRules();
    },
    onSuccess: () => {
      // Invalidate related queries after successful import
      queryClient.invalidateQueries({ queryKey: ["thirdPartyRules"] });
    },
  });

  return {
    rulePaths: data?.rulePaths || [],
    workspaceRuleExists: data?.workspaceRuleExists ?? true,
    importThirdPartyRules: importMutation.mutate,
    isImporting: importMutation.isPending,
  };
}
