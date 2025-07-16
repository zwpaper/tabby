import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SubscriptionLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  existingPlanName: string;
  url: string;
}

export function SubscriptionLimitDialog({
  open,
  onOpenChange,
  planName,
  existingPlanName,
  url,
}: SubscriptionLimitDialogProps) {
  const onConfirm = () => {
    window.location.href = url;
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Subscription Limit Reached</AlertDialogTitle>
          <AlertDialogDescription>
            You already have an active subscription to the{" "}
            <span className="font-semibold">{existingPlanName}</span> plan.
            Please cancel it before subscribing to a new{" "}
            <span className="font-semibold">{planName}</span> plan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Go to Billing Portal
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
