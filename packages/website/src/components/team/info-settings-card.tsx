import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { Organization } from "better-auth/plugins";
import { useForm } from "react-hook-form";

import { toast } from "sonner";
import { z } from "zod";

const FormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(5, "Team name must be at least 5 characters.")
    .max(32, "Please use 32 characters at maximum.")
    .regex(/^[a-zA-Z0-9-]+$/, {
      message: "Only letters, numbers, and hyphens are allowed.",
    }),
  slug: z
    .string()
    .trim()
    .min(5, "Slug must be at least 5 characters.")
    .max(48, "Please use 48 characters at maximum.")
    .regex(/^[a-z0-9-]+$/, {
      message: "Only lowercase letters, numbers, and hyphens are allowed.",
    }),
});

interface InfoSettingsCardProps {
  organization: Organization;
  disabled?: boolean;
}

export function InfoSettingsCard({
  organization,
  disabled,
}: InfoSettingsCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refetch } = authClient.useActiveOrganization();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: organization.name ?? "",
      slug: organization.slug ?? "",
    },
  });

  const updateOrganizationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof FormSchema>) => {
      return authClient.organization.update({
        organizationId: organization.id,
        data,
        fetchOptions: { throw: true },
      });
    },
    onSuccess: async (updatedOrganization) => {
      toast.success("Team updated successfully");

      try {
        // Refetch the active organization to ensure the data is fresh before navigating.
        await refetch();

        // Also invalidate queries to ensure all related data is refreshed
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === "activeOrganization",
        });

        // Check if the slug has changed and navigate to the new URL.
        if (
          updatedOrganization.slug &&
          updatedOrganization.slug !== organization.slug
        ) {
          router.navigate({
            to: "/teams/$slug",
            params: { slug: updatedOrganization.slug },
            replace: true,
          });
        }
      } catch (e) {
        toast.error("Failed to refresh team data. Please reload the page.");
      }
    },
    onError: (error) => {
      toast.error("Failed to update team", {
        description: error.message,
      });
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await updateOrganizationMutation.mutateAsync(data);
  });

  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>Team Information</CardTitle>
        <CardDescription>
          Update your team's visible name and URL namespace.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4 px-6 pb-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={disabled} />
                  </FormControl>
                  <FormDescription>
                    This is your team's visible name.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug URL</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={disabled} />
                  </FormControl>
                  <FormDescription>
                    This is your team's URL namespace.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="!py-3 flex justify-center border-t bg-muted/30 px-6 md:justify-end">
            <Button
              type="submit"
              disabled={
                disabled ||
                updateOrganizationMutation.isPending ||
                !form.formState.isDirty
              }
            >
              {updateOrganizationMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
