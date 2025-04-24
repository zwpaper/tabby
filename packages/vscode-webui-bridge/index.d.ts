export interface VSCodeHostApi {
  getToken(): Promise<string | undefined>;
  setToken(token: string | undefined): Promise<void>;
}
