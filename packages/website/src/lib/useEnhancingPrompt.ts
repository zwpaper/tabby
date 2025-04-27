import { apiClient } from "@/lib/auth-client";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Hook for enhancing user prompts by converting them into more detailed instructions
 */
export function useEnhancingPrompt() {
  const [isPending, setIsPending] = useState(false);

  /**
   * Call API to enhance a prompt
   * @param prompt Original user prompt
   * @param onAuthRequired Callback function when authorization fails
   * @returns Enhanced prompt
   */
  const enhancePrompt = async (prompt: string): Promise<string> => {
    if (!prompt || prompt.trim() === "") {
      return prompt;
    }

    setIsPending(true);

    try {
      const res = await apiClient.api.enhancePrompt.$post({
        json: { prompt },
      });

      if (!res.ok) {
        toast.error("Failed to enhance prompt");
        return prompt;
      }

      const data = await res.json();
      return data.enhanced;
    } catch (err) {
      toast.error("Failed to enhance prompt");
      return prompt;
    } finally {
      setIsPending(false);
    }
  };

  return {
    enhancePrompt,
    isPending,
  };
}
