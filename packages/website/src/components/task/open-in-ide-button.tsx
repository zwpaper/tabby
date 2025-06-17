import { Button } from "@/components/ui/button";
import { AppWindow, Cloud } from "lucide-react";

interface OpenInIdeButtonProps {
  uid: string;
  minionId?: string | null;
}

export function OpenInIdeButton({ uid, minionId }: OpenInIdeButtonProps) {
  const handleOpenInIde = () => {
    window.open(`vscode://tabbyml.pochi/?task=${uid}`, "_blank");
  };

  const handleOpenInRemotePochi = () => {
    if (!minionId) return;

    const minionUrl = `/api/minions/${minionId}/redirect`;
    window.open(minionUrl, "_blank");
  };

  const callToAction = minionId ? (
    <>
      <Cloud className="size-4" />
      Remote
    </>
  ) : (
    <>
      <AppWindow className="size-4" />
      Open
    </>
  );

  return (
    <Button
      type="button"
      onClick={minionId ? handleOpenInRemotePochi : handleOpenInIde}
      variant="ghost"
      size="sm"
      className="gap-1 rounded-md text-xs transition-opacity"
    >
      {callToAction}
    </Button>
  );
}
