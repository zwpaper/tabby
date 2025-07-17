import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Organization } from "better-auth/plugins";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const FormSchema = z.object({
  name: z
    .string()
    .min(1, "Team name is required")
    .regex(/[A-Za-z-]+/, {
      message: "Only alphabetic characters and hyphens are allowed",
    }),
});

interface CreateTeamFormProps {
  onCreated?: (organization: Organization) => void;
}

export function CreateTeamForm({ onCreated }: CreateTeamFormProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
    },
  });
  const { refetch: refetchActiveOrganization } =
    authClient.useActiveOrganization();

  const createOrganizationMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const slug = data.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      const organization = await authClient.organization.create({
        ...data,
        slug,
        fetchOptions: { throw: true },
      });

      await authClient.organization.setActive({
        organizationId: organization.id,
      });

      refetchActiveOrganization();
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "activeOrganization",
      });
      return organization;
    },
    onSuccess: (organization: Organization) => {
      toast.success("Team created successfully");
      onCreated?.(organization);
    },
    onError: (error) => {
      toast.error("Failed to create team", {
        description: error.message,
      });
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await createOrganizationMutation.mutateAsync(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team Name</FormLabel>
              <FormControl>
                <Input placeholder="Your team's name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={createOrganizationMutation.isPending}>
          {createOrganizationMutation.isPending ? "Creating..." : "Create Team"}
        </Button>
      </form>
    </Form>
  );
}
