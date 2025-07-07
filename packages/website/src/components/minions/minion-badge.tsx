import { getMinionRedirectUrl } from "@/lib/utils/minions";
import { HardDrive } from "lucide-react";
import { Badge } from "../ui/badge";

interface MinionBadgeProps {
  minionId: string;
}

export function MinionBadge({ minionId }: MinionBadgeProps) {
  const minionUrl = getMinionRedirectUrl(minionId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(minionUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Badge
      variant="secondary"
      className="cursor-pointer hover:opacity-70"
      onClick={handleClick}
    >
      <HardDrive className="h-4 w-4" />
      <span>remote</span>
    </Badge>
  );
}
