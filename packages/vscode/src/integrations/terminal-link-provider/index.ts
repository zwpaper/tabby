import { inject, injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
import {
  convertUrl,
  extractHttpUrls,
  isLocalUrl,
  promptPublicUrlConversion,
} from "./url-utils";

type LinkToHandle = vscode.TerminalLink & {
  url: vscode.Uri;
};

@injectable()
@singleton()
export class TerminalLinkProvider implements vscode.Disposable {
  private registration: vscode.Disposable | undefined;

  constructor(
    @inject("vscode.ExtensionContext")
    private readonly context: vscode.ExtensionContext,
  ) {
    const sandboxHost = process.env.POCHI_SANDBOX_HOST;

    if (sandboxHost) {
      this.registration = vscode.window.registerTerminalLinkProvider({
        provideTerminalLinks: (
          context: vscode.TerminalLinkContext,
        ): LinkToHandle[] => {
          return extractHttpUrls(context.line)
            .filter((item) => {
              return isLocalUrl(item.url);
            })
            .map((item) => {
              return {
                startIndex: item.start,
                length: item.length,
                tooltip: "Open in new tab",
                url: convertUrl(item.url, sandboxHost),
              };
            });
        },

        handleTerminalLink: async (link: LinkToHandle) => {
          const result = await promptPublicUrlConversion(
            link.url,
            this.context.globalState,
          );
          if (!result) {
            return;
          }
          vscode.env.openExternal(link.url);
        },
      });
    }
  }

  dispose() {
    this.registration?.dispose();
  }
}
