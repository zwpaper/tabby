import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
import { convertUrl, extractHttpUrls, isLocalUrl } from "./url-utils";

type LinkToHandle = vscode.TerminalLink & {
  url: vscode.Uri;
};

@injectable()
@singleton()
export class TerminalLinkProvider implements vscode.Disposable {
  private registeration: vscode.Disposable | undefined;

  constructor() {
    const sandboxHost = process.env.POCHI_SANDBOX_HOST;

    if (sandboxHost) {
      this.registeration = vscode.window.registerTerminalLinkProvider({
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

        handleTerminalLink: (link: LinkToHandle) => {
          vscode.env.openExternal(link.url);
        },
      });
    }
  }

  dispose() {
    this.registeration?.dispose();
  }
}
