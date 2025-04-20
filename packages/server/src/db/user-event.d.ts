import type { KnownEventFromType } from "@slack/bolt";

type UserEvent = {
  type: "slack:message";
  data: KnownEventFromType<"message">;
};
