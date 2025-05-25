import type { z } from "zod";

import type { ClientToolsType } from "@ragdoll/tools";

export type Todo = z.infer<
  ClientToolsType["todoWrite"]["parameters"]
>["todos"][number];
