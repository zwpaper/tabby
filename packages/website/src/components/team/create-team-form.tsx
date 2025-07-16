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
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const FormSchema = z.object({
  name: z.string().min(1, "Team name is required"),
});

interface CreateTeamFormProps {
  onCreated?: () => void;
}

export function CreateTeamForm({ onCreated }: CreateTeamFormProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
    },
  });

  const createOrganizationMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      // FIXME(juelanig): auto-generate slug, allow user to enter slug?
      const slug = data.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      const { error, data: returnedData } =
        await authClient.organization.create({ ...data, slug });
      if (error || !returnedData)
        throw error || new Error("Failed to create team");
      return returnedData;
    },
    onSuccess: () => {
      toast.success("Team created successfully");
      onCreated?.();
      queryClient.invalidateQueries({ queryKey: ["organization"] });
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
