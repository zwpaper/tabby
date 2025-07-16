import type { apiClient } from "@/lib/auth-client";
import type { InferResponseType } from "hono/client";
import moment from "moment";
import { Card, CardContent } from "../ui/card";

type Invoice = InferResponseType<typeof apiClient.api.billing.invoices.$get>;

export function InvoiceView({ invoice }: { invoice: Invoice }) {
  const total = invoice.total / 100;
  return (
    <Card className="mt-8 mb-4 rounded-sm border-0 bg-muted/30 py-0 shadow-none">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-sm">Next estimated payment</div>
            <div className="text-muted-foreground text-sm">
              {moment.unix(invoice.period_start).format("MMM D")} -
              {moment.unix(invoice.period_end).format("MMM D, YYYY")}
            </div>
          </div>
        </div>
        <div className="mt-2 flex justify-between pt-2 font-bold text-sm">
          <div>Total</div>
          <div>
            {total.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
