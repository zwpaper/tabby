import { Thread } from "@quilted/threads";
import type { VSCodeHostApi } from "@ragdoll/vscode-webui-bridge";
import {
  type CancellationToken,
  type EventEmitter,
  Uri,
  type Webview,
  type WebviewView,
  type WebviewViewProvider,
  type WebviewViewResolveContext,
} from "vscode";
import { Extension } from "./helpers/extension";
import { getBaseUrl } from "./lib/auth-client";
import type { TokenStorage } from "./lib/token-storage";
import { getNonce } from "./utils/get-nonce";
import { getUri } from "./utils/get-uri";

class Ragdoll implements WebviewViewProvider {
  public static readonly viewType = "ragdollWebui";
  private static instance: Ragdoll;
  private view?: WebviewView;

  constructor(
    private readonly extensionUri: Uri,
    private readonly tokenStorage: TokenStorage,
    private readonly events: {
      loginEvent: EventEmitter<void>;
      logoutEvent: EventEmitter<void>;
    },
  ) {}

  public static getInstance(
    extensionUri: Uri,
    tokenStorage: TokenStorage,
    events: {
      loginEvent: EventEmitter<void>;
      logoutEvent: EventEmitter<void>;
    },
  ): Ragdoll {
    if (!Ragdoll.instance) {
      Ragdoll.instance = new Ragdoll(extensionUri, tokenStorage, events);
    }

    return Ragdoll.instance;
  }

  public resolveWebviewView(
    webviewView: WebviewView,
    _context: WebviewViewResolveContext,
    _token: CancellationToken,
  ) {
    this.view = webviewView;

    this.view.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [this.extensionUri],
    };

    this.view.webview.html = this.getHtmlForWebview(this.view.webview);

    // Force reload on login/logout
    this.events.loginEvent.event(() => {
      webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    });
    this.events.logoutEvent.event(() => {
      webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    });

    this.createWebviewThread(webviewView.webview);
  }

  private createWebviewThread(webview: Webview) {
    const tokenStorage = this.tokenStorage;
    const thread = new Thread<unknown, VSCodeHostApi>(
      {
        send(message) {
          return webview.postMessage(message);
        },
        listen(listen, { signal }) {
          const { dispose } = webview.onDidReceiveMessage((message) => {
            listen(message);
          });
          signal?.addEventListener(
            "abort",
            () => {
              dispose();
            },
            { once: true },
          );
        },
      },
      {
        exports: {
          async getToken(): Promise<string | undefined> {
            return tokenStorage.getToken();
          },
          async setToken(token: string | undefined): Promise<void> {
            return tokenStorage.setToken(token);
          },
        },
      },
    );
    return thread;
  }

  private getHtmlForWebview(webview: Webview) {
    const file = "src/main.tsx";
    const localPort = "4112";
    const localServerUrl = `localhost:${localPort}`;

    // The CSS file from the React build output
    let scriptUri: Uri;
    const isProd = Extension.getInstance().isProductionMode;
    if (isProd) {
      // FIXME: this need to be fixed
      scriptUri = getUri(webview, this.extensionUri, [
        "webview-ui",
        "build",
        "assets",
        "index.js",
      ]);
    } else {
      scriptUri = Uri.parse(`http://${localServerUrl}/${file}`);
    }

    const nonce = getNonce();

    const reactRefresh = /*html*/ `
      <script type="module">
        import RefreshRuntime from "http://localhost:${localPort}/@react-refresh"
        RefreshRuntime.injectIntoGlobalHook(window)
        window.$RefreshReg$ = () => {}
        window.$RefreshSig$ = () => (type) => type
        window.__vite_plugin_react_preamble_installed__ = true
      </script>`;

    const reactRefreshHash =
      "sha256-yL+3q2cca0YKq6RvbZxpS67pnyG8uCKFMrhN3CvGX8A=";

    const csp = [
      `default-src 'none';`,
      `img-src https://* ${
        isProd
          ? `'nonce-${nonce}'`
          : `http://${localServerUrl} http://0.0.0.0:${localPort}`
      }`,
      `script-src 'unsafe-eval' https://* ${
        isProd
          ? `'nonce-${nonce}'`
          : `http://${localServerUrl} http://0.0.0.0:${localPort} '${reactRefreshHash}'`
      }`,
      `style-src ${webview.cspSource} 'self' 'unsafe-inline' https://*`,
      `font-src ${webview.cspSource}`,
      `connect-src https://* ${
        isProd
          ? ""
          : `ws://${localServerUrl} ws://0.0.0.0:${localPort} http://${localServerUrl} http://0.0.0.0:${localPort} ${getBaseUrl()}`
      }`,
    ];

    return /*html*/ `<!DOCTYPE html>
    <html lang="en">
      <head>
        <!-- ${new Date()} -->
        <meta charset="UTF-8" />
        <meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}">
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>VSCode React Starter</title>
        <style>body { padding: 0; margin: 0; }</style>
      </head>
      <body>
        <div id="app"></div>
        ${isProd ? "" : reactRefresh}
        <script type="module" src="${scriptUri}"></script>
      </body>
    </html>`;
  }
}

export default Ragdoll;
