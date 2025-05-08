import VSCodeHostImpl from "@/integrations/webview/vscode-host-impl";
import type { AuthEvents } from "@/lib/auth-events";
import { Extension } from "@/lib/extension";
import { getNonce } from "@/lib/get-nonce";
import { getUri } from "@/lib/get-uri";
import type { TokenStorage } from "@/lib/token-storage";
import { Thread } from "@quilted/threads";
import {
  type ResourceURI,
  type SessionState,
  type VSCodeHostApi,
  type WebviewHostApi,
  getServerBaseUrl,
} from "@ragdoll/vscode-webui-bridge";
import {
  type CancellationToken,
  EventEmitter,
  Uri,
  type Webview,
  type WebviewView,
  type WebviewViewProvider,
  type WebviewViewResolveContext,
} from "vscode";

class RagdollWebviewProvider implements WebviewViewProvider {
  public static readonly viewType = "ragdollWebui";
  private static instance?: RagdollWebviewProvider;

  private view?: WebviewView;
  private webviewHost?: WebviewHostApi;
  private webviewHostReady = new EventEmitter<WebviewHostApi>();
  private sessionState: SessionState = {};

  constructor(
    private readonly extensionUri: Uri,
    private readonly tokenStorage: TokenStorage,
    private readonly events: AuthEvents,
  ) {}

  public static getInstance(
    extensionUri: Uri,
    tokenStorage: TokenStorage,
    events: {
      loginEvent: EventEmitter<void>;
      logoutEvent: EventEmitter<void>;
    },
  ): RagdollWebviewProvider {
    if (!RagdollWebviewProvider.instance) {
      RagdollWebviewProvider.instance = new RagdollWebviewProvider(
        extensionUri,
        tokenStorage,
        events,
      );
    }

    return RagdollWebviewProvider.instance;
  }

  public async retrieveWebviewHost(): Promise<WebviewHostApi> {
    if (this.webviewHost) {
      return this.webviewHost;
    }

    return new Promise((resolve) => {
      this.webviewHostReady.event((host) => resolve(host));
    });
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

    this.events.loginEvent.event(() => {
      this.webviewHost?.onAuthChanged();
    });

    this.events.logoutEvent.event(() => {
      this.webviewHost?.onAuthChanged();
    });

    this.webviewHost = this.createWebviewThread(webviewView.webview).imports;
    this.webviewHostReady.fire(this.webviewHost);
  }

  readResourceURI: VSCodeHostApi["readResourceURI"] =
    async (): Promise<ResourceURI> => {
      if (!this.view) {
        throw new Error("Webview not initialized");
      }

      return {
        logo128: getUri(this.view.webview, this.extensionUri, [
          "assets",
          "icons",
          "logo128.png",
        ]).toString(),
      };
    };

  private createWebviewThread(webview: Webview) {
    const vscodeHost = new VSCodeHostImpl(
      this.tokenStorage,
      this.sessionState,
      this.readResourceURI.bind(this),
    );
    return new Thread<WebviewHostApi, VSCodeHostApi>(
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
        exports: vscodeHost,
        imports: ["openTask", "openTaskList", "onAuthChanged"],
      },
    );
  }

  private getHtmlForWebview(webview: Webview) {
    const isProd = Extension.getInstance().isProductionMode;

    if (isProd) {
      const nonce = getNonce();

      const scriptUri = getUri(webview, this.extensionUri, [
        "assets",
        "webview-ui",
        "dist",
        "index.js",
      ]);
      const script = `<script nonce="${nonce}" type="module" src="${scriptUri}"></script>`;

      const styleUri = getUri(webview, this.extensionUri, [
        "assets",
        "webview-ui",
        "dist",
        "index.css",
      ]);
      const style = `<link rel="stylesheet" href="${styleUri}">`;

      const csp = [
        `default-src 'none';`,
        `img-src ${webview.cspSource} https://* blob: data:`,
        `script-src 'nonce-${nonce}'`,
        `style-src ${webview.cspSource}`,
        `font-src ${webview.cspSource}`,
        `connect-src ${getServerBaseUrl()}`,
      ];
      const cspHeader = `<meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}">`;

      return this.buildHtml([cspHeader, style], [script]);
    }

    const devWebUIPort = "4112";
    const devWebUIHttpBaseUrl = `http://localhost:${devWebUIPort}`;
    const devWebUIHttpBaseUrlIp = `http://0.0.0.0:${devWebUIPort}`;
    const devWebUIWsBaseUrl = `ws://localhost:${devWebUIPort}`;
    const devWebUIWsBaseUrlIp = `ws://0.0.0.0:${devWebUIPort}`;

    const scriptUri = Uri.parse(`${devWebUIHttpBaseUrl}/src/main.tsx`);
    const script = `<script type="module" src="${scriptUri}"></script>`;

    const reactRefresh = /*html*/ `
      <script type="module">
        import RefreshRuntime from "${devWebUIHttpBaseUrl}/@react-refresh"
        RefreshRuntime.injectIntoGlobalHook(window)
        window.$RefreshReg$ = () => {}
        window.$RefreshSig$ = () => (type) => type
        window.__vite_plugin_react_preamble_installed__ = true
      </script>`;

    const reactRefreshHash =
      "sha256-yL+3q2cca0YKq6RvbZxpS67pnyG8uCKFMrhN3CvGX8A=";

    const csp = [
      `default-src 'none';`,
      `img-src ${devWebUIHttpBaseUrl} ${devWebUIHttpBaseUrlIp} https://* blob: data:`,
      `script-src ${devWebUIHttpBaseUrl} ${devWebUIHttpBaseUrlIp} '${reactRefreshHash}' 'unsafe-eval'`,
      `style-src ${webview.cspSource} 'self' 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `connect-src ${devWebUIHttpBaseUrl} ${devWebUIHttpBaseUrlIp} ${devWebUIWsBaseUrl} ${devWebUIWsBaseUrlIp} ${getServerBaseUrl()}`,
    ];
    const cspHeader = `<meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}">`;

    return this.buildHtml([cspHeader], [reactRefresh, script]);
  }

  private buildHtml(headElements: string[], bodyElements: string[]): string {
    return /*html*/ `<!DOCTYPE html>
    <html lang="en">
      <head>
        <!-- ${new Date()} -->
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Pochi</title>
        <style>body { padding: 0; margin: 0; }</style>
        ${headElements.join("\n")}
      </head>
      <body>
        <div id="app"></div>
        ${bodyElements.join("\n")}
      </body>
    </html>`;
  }
}

export default RagdollWebviewProvider;
