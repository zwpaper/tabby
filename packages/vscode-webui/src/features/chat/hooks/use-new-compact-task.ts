import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

export const useNewCompactTask = ({
  compact,
}: {
  compact: () => Promise<string>;
}) => {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      return compact();
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
