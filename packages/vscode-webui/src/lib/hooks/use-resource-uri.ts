import { useQuery } from "@tanstack/react-query";
import { vscodeHost } from "../vscode";

/**
 * Hook to get resource URI containing logo and other resources
 */
export const useResourceURI = () => {
  const { data } = useQuery({
    queryKey: ["resourceURI"],
    queryFn: () => vscodeHost.readResourceURI(),
    staleTime: Number.POSITIVE_INFINITY, // Resource URI is static
  });

  return data;
};
