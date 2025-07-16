import type { apiClient } from "@/lib/auth-client";
import type { InferResponseType } from "hono/client";
import moment from "moment";
// import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

type Invoice = InferResponseType<typeof apiClient.api.billing.invoices.$get>;

export function InvoiceView({ invoice }: { invoice: Invoice }) {
  const lineItems = invoice.lines.data;
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
          {/* <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = "/api/billing/portal";
            }}
          >
            View more
          </Button> */}
        </div>
        <div className="mt-4 space-y-2">
          {lineItems.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <div>
                <div>{item.description}</div>
                <div className="text-muted-foreground text-sm">
                  Qty {item.quantity?.toLocaleString() ?? 0}
                </div>
              </div>
              <div className="text-right">
                <div>
                  {(item.amount / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                  })}
                </div>
                {item.unit_amount_excluding_tax && (
                  <div className="text-muted-foreground text-sm">
                    $ {item.unit_amount_excluding_tax} each
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between pt-2 font-bold">
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
