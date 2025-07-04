import { Button } from "@/components/ui/button";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const FormSchema = z.object({
  monthlyCreditLimit: z
    .union([
      z.coerce
        .number()
        .int()
        .min(10, { message: "Credit limit must be between $10 and $2000" })
        .max(2000, { message: "Credit limit must be between $10 and $2000" }),
      z.literal(null),
    ])
    .refine((val): val is number => val !== null, {
      message: "Required",
    }),
});

export function SpendingLimitForm({
  defaultValues: propsDefaultValues,
  onSubmit,
  isSubmitting,
}: {
  defaultValues: Partial<z.input<typeof FormSchema>>;
  onSubmit: (values: z.infer<typeof FormSchema>) => void;
  isSubmitting: boolean;
}) {
  const form = useForm<z.input<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      monthlyCreditLimit: propsDefaultValues.monthlyCreditLimit ?? null,
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => {
          // The refine function ensures that `monthlyCreditLimit` is not null here,
          // but we cast to satisfy the `onSubmit` prop's type.
          onSubmit(values as z.infer<typeof FormSchema>);
        })}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="monthlyCreditLimit"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <span className="flex gap-2">
                  <FormLabel>Monthly Limit ($)</FormLabel>
                  <Input
                    type="number"
                    placeholder="10"
                    className="h-6 w-full md:w-[120px]"
                    step="1"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const num = e.target.valueAsNumber;
                      if (Number.isNaN(num)) {
                        return field.onChange(null);
                      }
                      return field.onChange(Math.trunc(num));
                    }}
                  />
                </span>
              </FormControl>
              <FormMessage />
              <FormDescription className="text-xs">
                Set a monthly limit to control your spending (between $10 and
                $2000).
              </FormDescription>
            </FormItem>
          )}
        />
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
      </form>
    </Form>
  );
}
