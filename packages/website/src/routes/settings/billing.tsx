import { createFileRoute } from "@tanstack/react-router";
import { Check as IconCheck } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/settings/billing")({
  loader: async () => {
    const { data, error } = await authClient.subscription.list();
    if (error) {
      throw error;
    }
    return {
      activeSubscriptions: data || null,
    };
  },
  component: Billing,
});

function SubscriptionPlan({
  name,
  price,
  description,
  features,
  isPopular,
  isActive,
  onSelect,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  isActive?: boolean;
  onSelect: () => void;
}) {
  return (
    <Card className="flex flex-col max-w-sm grow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{name}</CardTitle>
          {isPopular && <Badge variant="secondary">Most Popular</Badge>}
          {isActive && <Badge>Current Plan</Badge>}
        </div>
        <div className="flex items-baseline">
          <span className="text-3xl font-bold">{price}</span>
          {price !== "Free" && (
            <span className="text-muted-foreground ml-1">/month</span>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center">
              <IconCheck className="mr-2 h-4 w-4 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={isActive ? "outline" : "default"}
          onClick={onSelect}
        >
          {isActive ? "Current Plan" : "Select Plan"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function Billing() {
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [billingCycle, setBillingCycle] = useState("monthly");

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "Free",
      description: "Basic features for personal projects",
      features: ["1 user", "3 projects", "500 MB storage", "Basic analytics"],
    },
    {
      id: "pro",
      name: "Pro",
      price: "$19",
      description: "Everything in Free, plus more power and features",
      features: [
        "5 users",
        "Unlimited projects",
        "10 GB storage",
        "Advanced analytics",
        "Priority support",
      ],
      isPopular: true,
    },
  ];

  const handlePlanChange = (planId: string) => {
    setSelectedPlan(planId);
  };

  return (
    <div className="container max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Current Plan</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Billing Cycle:
            </span>
            <Select value={billingCycle} onValueChange={setBillingCycle}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select billing cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly (Save 20%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-4 mb-8 justify-around">
          {plans.map((plan) => (
            <SubscriptionPlan
              key={plan.id}
              name={plan.name}
              price={plan.price}
              description={plan.description}
              features={plan.features}
              isPopular={plan.isPopular}
              isActive={plan.id === selectedPlan}
              onSelect={() => handlePlanChange(plan.id)}
            />
          ))}
        </div>

        <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
          <div>
            <h3 className="font-medium">Need a custom plan?</h3>
            <p className="text-sm text-muted-foreground">
              Contact us for a tailored solution for your specific needs
            </p>
          </div>
          <Button variant="outline">Contact Sales</Button>
        </div>
      </div>
    </div>
  );
}
