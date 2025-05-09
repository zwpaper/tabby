import { injectable, singleton } from "tsyringe";
import { EventEmitter } from "vscode";

@injectable()
@singleton()
export class AuthEvents {
  public readonly loginEvent = new EventEmitter<void>();
  public readonly logoutEvent = new EventEmitter<void>();
}
