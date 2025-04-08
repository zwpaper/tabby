import { exec } from "node:child_process";
import { promisify } from "node:util";

const execPromise = promisify(exec);

interface TmuxPane {
  id: string;
  index: number;
  totalPanes: number;
}

/**
 * Manages a 3-pane tmux layout (main, command, server).
 * Ensures the layout exists and provides access to pane IDs.
 */
class WindowManager {
  private commandPaneId: string | null = null; // Top-right (index 1)
  private serverPaneId: string | null = null; // Bottom-right (index 2)

  /**
   * Initializes the WindowManager and ensures the 3-pane layout.
   * This method is asynchronous and should be awaited.
   */
  async setupLayout(): Promise<void> {
    try {
      await this.ensurePanes();
    } catch (err) {
      console.error(
        "Error managing tmux panes, attempting to create new 3-pane layout:",
        err,
      );
      // Fallback: Create a three-pane layout from scratch
      try {
        await this.createFreshLayout();
      } catch (fallbackErr) {
        console.error("Failed to create fallback 3-pane layout:", fallbackErr);
        // If even the fallback fails, re-throw the error.
        throw fallbackErr;
      }
    }

    if (!this.commandPaneId || !this.serverPaneId) {
      throw new Error("Failed to determine required pane IDs after setup.");
    }
  }

  /**
   * Returns the ID of the top-right pane (for command execution).
   * Throws an error if setupLayout() hasn't successfully completed.
   */
  getCommandPaneId(): string {
    if (!this.commandPaneId) {
      throw new Error(
        "Command pane ID not available. Ensure setupLayout() was called and completed successfully.",
      );
    }
    return this.commandPaneId;
  }

  /**
   * Returns the ID of the bottom-right pane (for server logs/output).
   * Throws an error if setupLayout() hasn't successfully completed.
   */
  getServerPaneId(): string {
    if (!this.serverPaneId) {
      throw new Error(
        "Server pane ID not available. Ensure setupLayout() was called and completed successfully.",
      );
    }
    return this.serverPaneId;
  }

  private async getPanes(): Promise<TmuxPane[]> {
    const { stdout: paneList } = await execPromise(
      'tmux list-panes -F "#{pane_id}:#{pane_index}:#{window_panes}"',
    );

    return paneList
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const [id, index, totalPanes] = line.split(":");
        return {
          id,
          index: Number.parseInt(index, 10),
          totalPanes: Number.parseInt(totalPanes, 10),
        };
      });
  }

  private async ensurePanes(): Promise<void> {
    const panes = await this.getPanes();

    if (panes.length === 0) {
      // Should not happen in a normal tmux session
      throw new Error("No panes found.");
    }

    const totalPanes = panes[0].totalPanes;
    let commandPane: TmuxPane | undefined;
    let serverPane: TmuxPane | undefined;

    if (totalPanes < 2) {
      // Case 1: Only 1 pane exists, create the other two
      const { stdout: topRightId } = await execPromise(
        'tmux split-window -h -d -P -F "#{pane_id}"', // Create top-right
      );
      this.commandPaneId = topRightId.trim();
      const { stdout: bottomRightId } = await execPromise(
        `tmux split-window -v -d -t ${this.commandPaneId} -P -F "#{pane_id}"`, // Create bottom-right
      );
      this.serverPaneId = bottomRightId.trim();
    } else if (totalPanes === 2) {
      // Case 2: 2 panes exist (assume left/right), create the third
      commandPane = panes.find((p) => p.index === 1);
      if (!commandPane) {
        throw new Error(
          "Could not find right pane (index 1) in 2-pane layout.",
        );
      }
      this.commandPaneId = commandPane.id;
      const { stdout: bottomRightId } = await execPromise(
        `tmux split-window -v -d -t ${this.commandPaneId} -P -F "#{pane_id}"`, // Create bottom-right from right pane
      );
      this.serverPaneId = bottomRightId.trim();
      await this.clearPane(this.commandPaneId); // Clear top-right
    } else {
      // Case 3: 3 or more panes exist, reuse top-right (1) and bottom-right (2)
      commandPane = panes.find((p) => p.index === 1);
      serverPane = panes.find((p) => p.index === 2); // Assuming standard layout

      if (!commandPane) {
        throw new Error(
          "Could not find command pane (index 1) in >=3-pane layout.",
        );
      }
      if (!serverPane) {
        // Attempt to find the pane directly below the command pane if index 2 isn't it
        const { stdout: paneBelow } = await execPromise(
          `tmux list-panes -F "#{pane_id}:#{pane_top}:#{pane_left}" | grep ":${
            (await this.getPaneGeometry(commandPane.id)).bottom
          }:" | cut -d: -f1`,
        ).catch(() => ({ stdout: "" })); // Ignore error if no pane below

        if (paneBelow.trim()) {
          serverPane = panes.find((p) => p.id === paneBelow.trim());
        }

        if (!serverPane) {
          console.warn(
            "Could not reliably find server pane (index 2 or below command pane). Splitting bottom-right again.",
          );
          // If we still can't find it, split the command pane again
          const { stdout: bottomRightId } = await execPromise(
            `tmux split-window -v -d -t ${commandPane.id} -P -F "#{pane_id}"`,
          );
          this.serverPaneId = bottomRightId.trim();
        } else {
          this.serverPaneId = serverPane.id;
        }
      } else {
        this.serverPaneId = serverPane.id;
      }

      this.commandPaneId = commandPane.id;

      // Clear both panes
      await this.clearPane(this.commandPaneId);
      if (this.serverPaneId) {
        await this.clearPane(this.serverPaneId);
      }
    }
  }

  private async createFreshLayout(): Promise<void> {
    // Kill all other panes in the current window except the first one (index 0)
    const panes = await this.getPanes();
    for (const pane of panes) {
      if (pane.index !== 0) {
        try {
          await execPromise(`tmux kill-pane -t ${pane.id}`);
        } catch (e) {
          // Ignore errors killing panes (e.g., if it was already gone)
        }
      }
    }
    // Wait briefly for panes to be killed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Now create the two new panes
    const { stdout: topRightId } = await execPromise(
      'tmux split-window -h -d -P -F "#{pane_id}"', // Create top-right
    );
    this.commandPaneId = topRightId.trim();
    const { stdout: bottomRightId } = await execPromise(
      `tmux split-window -v -d -t ${this.commandPaneId} -P -F "#{pane_id}"`, // Create bottom-right
    );
    this.serverPaneId = bottomRightId.trim();
  }

  private async clearPane(paneId: string): Promise<void> {
    try {
      // Send Ctrl+C first to interrupt any running process
      await execPromise(`tmux send-keys -t ${paneId} C-c`);
      // Then clear the screen
      await execPromise(`tmux send-keys -t ${paneId} "clear" Enter`);
    } catch (err) {
      console.warn(`Failed to clear pane ${paneId}:`, err);
      // Don't throw, clearing is best-effort
    }
  }

  private async getPaneGeometry(
    paneId: string,
  ): Promise<{ top: number; bottom: number; left: number; right: number }> {
    const { stdout } = await execPromise(
      `tmux display-message -p -t ${paneId} '#{pane_top}:#{pane_bottom}:#{pane_left}:#{pane_right}'`,
    );
    const [top, bottom, left, right] = stdout.trim().split(":").map(Number);
    return { top, bottom, left, right };
  }
}

const windowManager = new WindowManager();

export async function getCommandPaneId(): Promise<string> {
  await windowManager.setupLayout();
  return windowManager.getCommandPaneId();
}
