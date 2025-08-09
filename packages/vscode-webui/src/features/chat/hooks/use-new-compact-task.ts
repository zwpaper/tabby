import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

export const useNewCompactTask = ({
  compact,
  enabled,
}: {
  compact: () => Promise<string>;
  enabled: boolean;
}) => {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!enabled) {
        return;
      }
      return await compact();
    },
    onSuccess: (uid) => {
      router.navigate({ to: "/", search: { uid, ts: Date.now() } });
    },
  });

  return {
    newCompactTaskPending: mutation.isPending,
    newCompactTask: () => mutation.mutate(),
  };
};
