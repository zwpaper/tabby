import { EventEmitter } from "vscode";

export const authEvents = {
  loginEvent: new EventEmitter<void>(),
  logoutEvent: new EventEmitter<void>(),
};

export type AuthEvents = typeof authEvents;
