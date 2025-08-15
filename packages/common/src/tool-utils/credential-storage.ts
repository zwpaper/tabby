import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { getLogger } from "../base";
import { isFileExists } from "./fs";

export interface PochiCredential {
  bearer_token?: string;
}

const logger = getLogger("PochiCredentialStorage");

class CredentialStorage<T extends PochiCredential> {
  private isDev: boolean;

  constructor(options?: {
    isDev?: boolean;
  }) {
    this.isDev = options?.isDev ?? false;
  }

  private get credentialFilePath(): string {
    return path.join(
      os.homedir(),
      ".pochi",
      this.isDev ? "credentials-dev.json" : "credentials.json",
    );
  }

  private async readCredentials(): Promise<T | undefined> {
    try {
      if (!(await isFileExists(this.credentialFilePath))) {
        return undefined;
      }
      const data = await fs.readFile(this.credentialFilePath, "utf-8");
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(
        `Failed to read credential store file at ${this.credentialFilePath}:`,
        error,
      );
      return undefined;
    }
  }

  async read(): Promise<string | undefined> {
    const credential = await this.readCredentials();
    return credential ? credential.bearer_token : undefined;
  }

  async write(value: string | undefined): Promise<void> {
    try {
      const credential = (await this.readCredentials()) ?? ({} as T);
      const { bearer_token, ...rest } = credential;
      const updatedCredential =
        value !== undefined ? { ...rest, bearer_token: value } : rest;

      if (Object.keys(updatedCredential).length === 0) {
        // if credential becomes empty, remove the file
        if (await isFileExists(this.credentialFilePath)) {
          await fs.unlink(this.credentialFilePath);
        }
      } else {
        await fs.mkdir(path.dirname(this.credentialFilePath), {
          recursive: true,
        });
        await fs.writeFile(
          this.credentialFilePath,
          JSON.stringify(updatedCredential),
        );
      }
    } catch (error) {
      logger.error(
        `Failed to write credential storage file at ${this.credentialFilePath}:`,
        error,
      );
    }
  }
}

export { CredentialStorage };
