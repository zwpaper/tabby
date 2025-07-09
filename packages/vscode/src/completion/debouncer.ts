import type { DebouncingContext } from "./types";

export class Debouncer {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private baseInterval = 300; // Base debounce delay in ms

  async debounce(context: DebouncingContext): Promise<void> {
    const delay = this.calculateDelay(context);

    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    return new Promise((resolve) => {
      this.timeout = setTimeout(() => {
        resolve();
      }, delay);
    });
  }

  private calculateDelay(context: DebouncingContext): number {
    if (context.manually) {
      return 0; // Manual triggers execute immediately
    }

    const contextScore = this.calculateContextScore(context);
    const estimatedResponseTime = context.estimatedResponseTime || 0;

    // Adaptive rate calculation
    const adaptiveRate = 0.8 - 0.3 * contextScore; // Range: 0.5 to 0.8
    const expectedLatency = adaptiveRate * this.baseInterval;

    // Reduce delay based on estimated response time
    const delay = Math.max(100, expectedLatency - estimatedResponseTime);

    return Math.min(delay, 1000); // Cap at 1 second
  }

  private calculateContextScore(context: DebouncingContext): number {
    let score = 0;

    // Trigger character scoring
    if (this.isNonWordCharacter(context.triggerCharacter)) {
      score += 0.5; // Non-word characters get higher priority
    }

    // Line end gets higher priority
    if (context.isLineEnd) {
      score += 0.4;
    }

    // Document end gets slight priority
    if (context.isDocumentEnd) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  private isNonWordCharacter(char: string): boolean {
    return Boolean(char && !/\w/.test(char));
  }

  cancel(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}
