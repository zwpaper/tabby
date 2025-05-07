import copy from "copy-to-clipboard";
import { useState } from "react";

export interface useCopyToClipboardProps {
  timeout?: number;
  onError?: (e?: Error) => void;
}

export function useCopyToClipboard({
  timeout = 2000,
  onError,
}: useCopyToClipboardProps) {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const onCopySuccess = () => {
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, timeout);
  };

  const onCopyError = (error?: Error) => {
    if (typeof onError === "function") {
      onError?.(error);
      return;
    }
  };

  const copyToClipboard = (value: string) => {
    if (typeof window === "undefined") return;
    if (!value) return;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(value)
        .then(onCopySuccess)
        .catch((e) => {
          const error = e instanceof Error ? e : new Error("Failed to copy");
          onCopyError(error);
        });
    } else {
      const copyResult = copy(value);
      if (copyResult) {
        onCopySuccess();
      } else {
        onCopyError(new Error("Failed to copy"));
      }
    }
  };

  return { isCopied, copyToClipboard };
}
