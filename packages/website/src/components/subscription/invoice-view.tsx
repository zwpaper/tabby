import type { apiClient } from "@/lib/auth-client";
import type { InferResponseType } from "hono/client";
import moment from "moment";
import { Card, CardContent } from "../ui/card";

type Invoice = InferResponseType<typeof apiClient.api.billing.invoices.$get>;

export function InvoiceView({ invoice }: { invoice: Invoice }) {
  const total = invoice.amount_due / 100;

  const dollar = total.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  return (
    <Card className="mt-8 mb-4 rounded-sm border-0 bg-muted/30 py-0 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            {moment.unix(invoice.period_start).format("MMM D")} -{" "}
            {moment.unix(invoice.period_end).format("MMM D, YYYY")}
          </div>
          <div className="flex items-center gap-1 text-sm">
            <span>Your estimated next payment will be</span>
            <span className="font-semibold">{dollar}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
