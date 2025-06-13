import type { AuthClient } from "@/lib/auth-client";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { AuthEvents } from "@/lib/auth-events";
import { getLogger } from "@ragdoll/common";
import { inject, singleton } from "tsyringe";
import {
  type AuthenticationProvider,
  type AuthenticationProviderAuthenticationSessionsChangeEvent,
  type AuthenticationSession,
  type Disposable,
  EventEmitter,
  authentication,
  commands,
} from "vscode";

const logger = getLogger("PochiAuthenticationProvider");
const PochiAuthProviderId = "pochi";

@singleton()
export class PochiAuthenticationProvider
  implements AuthenticationProvider, Disposable
{
  private sessionChangeEmitter =
    new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
  private disposables: Disposable[] = [];
  private currentSession: AuthenticationSession | undefined;

  constructor(
    @inject("AuthClient") private readonly authClient: AuthClient,
    private readonly authEvents: AuthEvents,
  ) {
    this.disposables.push(
      authentication.registerAuthenticationProvider(
        PochiAuthProviderId,
        "Pochi",
        this,
        {
          supportsMultipleAccounts: false,
        },
      ),
    );
    this.disposables.push(
      this.authEvents.loginEvent.event(() => {
        // handle login from webview
        logger.debug("User logged in, refreshing sessions");
        this.getSessions().then((sessions) => {
          this.currentSession = sessions[0];
          this.sessionChangeEmitter.fire({
            added: sessions,
            removed: [],
            changed: [],
          });
        });
      }),
    );
    this.disposables.push(
      this.authEvents.logoutEvent.event(() => {
        // handle logout from webview
        logger.debug("User logged out, clearing sessions");
        if (!this.currentSession) {
          logger.warn("No current session to clear on logout");
          return;
        }
        this.sessionChangeEmitter.fire({
          added: [],
          removed: [this.currentSession],
          changed: [],
        });
        this.currentSession = undefined;
      }),
    );
    // make sure pochi extension use this authentication provider at least once
    authentication.getSession(PochiAuthProviderId, [], {}).then((sessions) => {
      logger.debug("Existing sessions:", sessions?.id, sessions?.account);
      this.currentSession = sessions;
    });
  }

  get onDidChangeSessions() {
    return this.sessionChangeEmitter.event;
  }

  /**
   * Get the existing sessions
   * @param scopes
   * @returns
   */
  public async getSessions(): Promise<AuthenticationSession[]> {
    const { data } = await this.authClient.getSession();
    if (!data?.session) {
      return [];
    }

    const session: AuthenticationSession = {
      id: data.session.id,
      accessToken: data.session.token,
      account: {
        id: data.user.id,
        label: data.user.name,
      },
      scopes: [],
    };

    return [session];
  }

  /**
   * Create a new auth session
   * @param scopes
   * @returns
   */
  public async createSession(): Promise<AuthenticationSession> {
    await commands.executeCommand("ragdoll.openLoginPage");
    return new Promise((resolve, reject) => {
      const disposable = this.authEvents.loginEvent.event(() => {
        disposable.dispose();
        this.getSessions()
          .then((sessions) => {
            if (sessions.length === 0) {
              reject(new Error("No session found after login"));
            } else {
              this.sessionChangeEmitter.fire({
                added: sessions,
                removed: [],
                changed: [],
              });
              this.currentSession = sessions[0];
              resolve(sessions[0]);
            }
          })
          .catch(reject);
      });
    });
  }

  /**
   * Remove an existing session
   * @param sessionId
   */
  public async removeSession(sessionId: string): Promise<void> {
    const sessions = await this.getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`Session with id ${sessionId} not found`);
    }
    await commands.executeCommand("ragdoll.logout");
    this.sessionChangeEmitter.fire({
      added: [],
      removed: [session],
      changed: [],
    });
    this.currentSession = undefined;
  }

  /**
   * Dispose the registered services
   */
  dispose() {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
