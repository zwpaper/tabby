import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { CheckIcon, Share2 } from "lucide-react";

interface ShareButtonProps {
  uid: string | undefined;
  disabled?: boolean;
}

export function ShareButton({ uid, disabled }: ShareButtonProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 });

  const copyShareLink = () => {
    if (isCopied || !uid) return;
    copyToClipboard(`https://app.getpochi.com/share/${uid}`);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1 rounded-md text-xs transition-opacity"
      disabled={disabled}
      onClick={copyShareLink}
    >
      {isCopied ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <Share2 className="size-3.5" />
      )}
      Share
    </Button>
  );
}
