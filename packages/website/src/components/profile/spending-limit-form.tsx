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
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const createSpendingLimitFormSchema = ({
  min,
  max,
}: { min: number; max: number }) =>
  z.object({
    monthlyCreditLimit: z
      .union([
        z.coerce
          .number()
          .int()
          .min(min, {
            message: `Credit limit must be between $${min} and $${max}`,
          })
          .max(max, {
            message: `Credit limit must be between $${min} and $${max}`,
          }),
        z.literal(null),
      ])
      .refine((val): val is number => val !== null, {
        message: "Required",
      }),
  });

type SpendingLimitFormSchema = ReturnType<typeof createSpendingLimitFormSchema>;

export function SpendingLimitForm({
  defaultValues: propsDefaultValues,
  onSubmit,
  isSubmitting,
  disabled,
  minBudgetUsd = 10,
  maxBudgetUsd = 2000,
}: {
  defaultValues: Partial<z.input<SpendingLimitFormSchema>>;
  onSubmit: (values: z.infer<SpendingLimitFormSchema>) => void;
  isSubmitting: boolean;
  disabled?: boolean;
  minBudgetUsd?: number;
  maxBudgetUsd?: number;
}) {
  const formSchema = React.useMemo(
    () =>
      createSpendingLimitFormSchema({ min: minBudgetUsd, max: maxBudgetUsd }),
    [minBudgetUsd, maxBudgetUsd],
  );

  const form = useForm<z.input<SpendingLimitFormSchema>>({
    resolver: zodResolver(formSchema),
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
          onSubmit(values as z.infer<SpendingLimitFormSchema>);
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
                  <FormLabel className="w-full md:w-auto">
                    Monthly Limit ($)
                  </FormLabel>
                  <Input
                    type="number"
                    placeholder="10"
                    className="h-6 text-sm md:w-[120px]"
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
                Set a monthly limit to control your spending (between $
                {minBudgetUsd} and ${maxBudgetUsd}).
              </FormDescription>
            </FormItem>
          )}
        />
        <Button type="submit" size="sm" disabled={disabled || isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
      </form>
    </Form>
  );
}
