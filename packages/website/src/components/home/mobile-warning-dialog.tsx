import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LaptopIcon } from "lucide-react";

interface MobileWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileWarningDialog({
  open,
  onOpenChange,
}: MobileWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center">
            <LaptopIcon className="mr-2 h-5 w-5" />
            Limited Mobile Experience
          </DialogTitle>
          <DialogDescription className="pt-2 text-gray-600 leading-relaxed">
            Some features are only available on desktop devices. Visit{" "}
            <a
              href="https://app.getpochi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-500 hover:underline"
            >
              app.getpochi.com
            </a>{" "}
            on desktop for full functionality.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
