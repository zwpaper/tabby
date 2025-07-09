import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  fallbackUrl?: string;
  className?: string;
}

export function BackButton({ fallbackUrl = "/", className }: BackButtonProps) {
  const router = useRouter();

  const goBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
    } else {
      router.navigate({ to: fallbackUrl });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("items-center justify-center", className)}
      onClick={goBack}
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>
  );
}
