import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function tempfile(options: { extension?: string } = {}): string {
  let { extension } = options;

  if (typeof extension === "string") {
    extension = extension.startsWith(".") ? extension : `.${extension}`;
  }

  const tempDirectory = fs.realpathSync(os.tmpdir());
  return path.join(tempDirectory, randomUUID() + (extension ?? ""));
}
