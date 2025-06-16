import { HardDrive } from "lucide-react";
import { Badge } from "../ui/badge";

interface MinionBadgeProps {
  minionId: string;
}

export function MinionBadge({ minionId }: MinionBadgeProps) {
  const minionUrl = `/api/minions/${minionId}/redirect`;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(minionUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Badge className="cursor-pointer hover:opacity-70" onClick={handleClick}>
      <HardDrive className="h-4 w-4" />
      <span>Minion #{minionId}</span>
    </Badge>
  );
}
