import { PostHog as PostHogNode } from "posthog-node";
import { inject, injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";

@injectable()
@singleton()
export class PostHog implements vscode.Disposable {
  private readonly client = new PostHogNode(
    "phc_aBzNGHzlOy2C8n1BBDtH7d4qQsIw9d8T0unVlnKfdxB",
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
