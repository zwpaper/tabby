import { vscodeHost } from "@/lib/vscode";
import type { ExtendedUIMessage } from "@ragdoll/common";

interface CheckpointInfo {
  commit: string;
}

class CheckpointManager {
  // Mapping from a unique key to a checkpoint info
  private checkpoints: Map<string, CheckpointInfo> = new Map();

  async checkpointIfNeeded(opts: { messageId: string; step: number }) {
    const key = checkpointKey(opts);
    if (!this.checkpoints.has(key)) {
      const commit = await vscodeHost.saveCheckpoint(
        `task-${opts.messageId}-${opts.step}`,
      );
      this.checkpoints.set(key, { commit });
      return commit;
    }
  }

  fillCheckpoint(messages: ExtendedUIMessage[]) {
    let isDirty = false;
    for (const message of messages) {
      let step = 0;
      for (const part of message.parts) {
        if (part.type === "step-start" && !part.checkpoint?.commit) {
          isDirty = true;
          part.checkpoint = this.checkpoints.get(
            checkpointKey({
              messageId: message.id,
              step,
            }),
          );
        }

        if (part.type === "step-start") {
          step++;
        }
      }
    }

    return isDirty;
  }
}

function checkpointKey(key: { messageId: string; step: number }): string {
  return `ckpt-${key.messageId}-${key.step}`;
}

export default new CheckpointManager();
