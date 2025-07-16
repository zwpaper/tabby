import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IconInfoCircle } from "@tabler/icons-react";

export function JoinTeamView() {
  return (
    <Alert>
      <IconInfoCircle />
      <AlertTitle>How to join a team</AlertTitle>
      <AlertDescription>
        To join an existing team, you need to be invited by a team
        administrator. Once you receive an invitation, you will be able to
        accept it and join the team.
      </AlertDescription>
    </Alert>
  );
}
