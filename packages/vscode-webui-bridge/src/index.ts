export interface VSCodeHostApi {
  getToken(): Promise<string | undefined>;
  setToken(token: string | undefined): Promise<void>;
}

export interface WebviewHostApi {
  openTask(taskId: number): void;
}

const DevBaseUrl = "http://localhost:4113";
const ProdBaseUrl = "https://app.getpochi.com";

const isDev = true;

export function getServerBaseUrl() {
  return isDev ? DevBaseUrl : ProdBaseUrl;
}
