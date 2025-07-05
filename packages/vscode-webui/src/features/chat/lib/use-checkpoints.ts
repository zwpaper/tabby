import { vscodeHost } from "@/lib/vscode";
import { useCallback, useMemo, useRef, useState } from "react";

type CheckpointState =
  | {
      type: "init";
    }
  | {
      type: "saving";
      job: Promise<unknown>;
    }
  | {
      type: "saved";
      commit: string | null;
    };

class Checkpoint {
  state: CheckpointState = { type: "init" };

  constructor(
    private readonly message: string,
    private readonly requireChange: boolean,
  ) {}

  async saveIfNeeded(onSaved: () => void) {
    if (this.state.type === "init") {
      this.state = {
        type: "saving",
        job: vscodeHost
          .saveCheckpoint(this.message, {
            requireChange: this.requireChange,
          })
          .then((commit) => {
            this.state = {
              type: "saved",
              commit,
            };
            onSaved();
          }),
      };
    }

    if (this.state.type === "saving") {
      // Wait for the saving job to complete
      await this.state.job;
    }
  }
}

export function useCheckpoints() {
  const [checkpoints, setCheckpoints] = useState<Map<string, Checkpoint>>(
    new Map(),
  );

  const completedCheckpoints = useMemo(() => {
    const completed = new Map<string, string | null>();
    for (const [k, x] of checkpoints.entries()) {
      if (x.state.type === "saved") {
        completed.set(k, x.state.commit);
      }
    }
    return completed;
  }, [checkpoints]);

  // remove unused
  completedCheckpoints;

  const checkpointsRef = useRef<Map<string, Checkpoint>>(new Map());
  const reloadCheckpoints = useCallback(() => {
    setCheckpoints(new Map(checkpointsRef.current));
  }, []);

  const getCheckpoint = useCallback(
    (key: {
      messageId: string;
      step: number;
      isFirstAssistantMessage: boolean;
    }) => {
      let checkpoint = checkpointsRef.current.get(checkpointKey(key));
      if (!checkpoint) {
        checkpoint = new Checkpoint(
          key.messageId,
          !(key.isFirstAssistantMessage && key.step === 0),
        );
        checkpointsRef.current.set(checkpointKey(key), checkpoint);
        return checkpoint;
      }
      return checkpoint;
    },
    [],
  );

  const checkpoint = useCallback(
    (key: {
      messageId: string;
      step: number;
      isFirstAssistantMessage: boolean;
    }) => {
      const checkpoint = getCheckpoint(key);
      return checkpoint.saveIfNeeded(reloadCheckpoints);
    },
    [getCheckpoint, reloadCheckpoints],
  );

  return {
    checkpoint,
  };
}

function checkpointKey(key: { messageId: string; step: number }): string {
  return `ckpt-${key.messageId}-${key.step}`;
}
