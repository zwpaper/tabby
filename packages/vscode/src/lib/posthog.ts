import { PostHog as PostHogNode } from "posthog-node";
import { inject, injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";

@injectable()
@singleton()
export class PostHog implements vscode.Disposable {
  private readonly client = new PostHogNode(
    "phc_yAshPRA7kVY4GKm30kh4TSdyKwlbw0PGD2r5T5Tzv5U",
    {
      host: "https://us.i.posthog.com",
    },
  );

  private distinctId: string | undefined;
  private readonly commonProperties: Record<string, unknown>;

  constructor(
    @inject("vscode.ExtensionContext")
    context: vscode.ExtensionContext,
  ) {
    this.commonProperties = {
      extensionName: "TabbyML.pochi",
      extensionVersion: context.extension.packageJSON.version,
    };
  }

  identify(distinctId: string, properties?: Record<string, unknown>) {
    this.distinctId = distinctId;
    this.client.identify({
      distinctId,
      properties: {
        ...properties,
      },
    });
  }

  capture(event: string, properties?: Record<string, unknown>) {
    if (!this.distinctId) {
      return;
    }
    this.client.capture({
      distinctId: this.distinctId,
      event,
      properties: {
        ...this.commonProperties,
        ...properties,
      },
    });
  }

  async dispose() {
    await this.client.shutdown();
  }
}
