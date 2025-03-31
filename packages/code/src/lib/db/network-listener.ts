import dns from "dns";
import { promisify } from "util";

const lookup = promisify(dns.lookup);

export default class NetworkListener {
  private static intervalId: ReturnType<typeof setInterval> | null = null;
  private static currentStatus: boolean | null = null;
  private static isListening: boolean = false;
  private static readonly checkIntervalMs = 30000; // Check every 30 seconds
  private static readonly targetHost = "instantdb.com"; // Host to check against

  /**
   * Performs a one-time check for network connectivity using DNS resolution.
   * @param targetHost The hostname to resolve for checking connectivity (default: 'instantdb.com').
   * @returns Promise<boolean> True if online, false otherwise.
   */
  static async getIsOnline(
    targetHost = NetworkListener.targetHost,
  ): Promise<boolean> {
    try {
      await lookup(targetHost);
      return true;
    } catch (err: any) {
      // Using 'any' for broader error code compatibility
      // Check for specific error codes indicating offline status
      if (
        err &&
        (err.code === "ENOTFOUND" ||
          err.code === "ECONNREFUSED" ||
          err.code === "ETIMEDOUT" ||
          err.code === "EAI_AGAIN")
      ) {
        return false;
      }
      // Depending on requirements, you might want to return false here as well,
      // but returning true assumes connectivity unless specific offline errors occur.
      return true; // Or handle as an unknown state if necessary
    }
  }

  /**
   * Starts periodically checking the network status and logs changes.
   * Note: This static implementation logs changes to the console. For event-driven
   * handling, an instance-based approach (e.g., using EventEmitter) is recommended.
   */
  static listen() {
    if (NetworkListener.isListening) {
      return;
    }
    NetworkListener.isListening = true;

    // Perform initial check immediately
    NetworkListener.checkAndLogStatus();

    // Schedule periodic checks
    NetworkListener.intervalId = setInterval(
      NetworkListener.checkAndLogStatus,
      NetworkListener.checkIntervalMs,
    );

    // Allow Node.js to exit if this is the only timer left
    if (NetworkListener.intervalId) {
      NetworkListener.intervalId.unref();
    }
  }

  /**
   * Stops the periodic network status checks initiated by listen().
   */
  static stopListening() {
    if (!NetworkListener.isListening) {
      return;
    }
    if (NetworkListener.intervalId) {
      clearInterval(NetworkListener.intervalId);
      NetworkListener.intervalId = null;
    }
    NetworkListener.isListening = false;
    NetworkListener.currentStatus = null; // Reset status
  }

  /**
   * Internal method to check status and log if it changed.
   */
  private static async checkAndLogStatus() {
    const isOnline = await NetworkListener.getIsOnline();
    if (NetworkListener.currentStatus === null) {
      NetworkListener.currentStatus = isOnline;
    } else if (isOnline !== NetworkListener.currentStatus) {
      NetworkListener.currentStatus = isOnline;
    }
  }
}
