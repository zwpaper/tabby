import * as assert from "assert";
import * as os from "node:os";
import * as _path from "node:path"; // Renamed to avoid conflict if 'path' is used as a var name
import { after, before, beforeEach, describe, it } from "mocha";
import * as vscode from "vscode";
import { type IgnoreWalkOptions, ignoreWalk } from "../ignore-walk";
import type { FileResult } from "../types";

// Helper to create a file
async function createFile(uri: vscode.Uri, content = ""): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
}

// Helper to create a directory
async function createDirectory(uri: vscode.Uri): Promise<void> {
  await vscode.workspace.fs.createDirectory(uri);
}

function normalizeResults(results: FileResult[]): any[] {
  return results
    .map((r) => ({
      ...r,
      uri: r.uri.fsPath,
      relativePath: r.relativePath.replace(/\\/g, "/"),
    })) // Normalize path separators for cross-platform consistency
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

describe("ignoreWalk with real file system", () => {
  let testSuiteRootTempDir: vscode.Uri;
  let currentTestTempDirUri: vscode.Uri;

  before(async () => {
    const rootPath = _path.join(
      os.tmpdir(),
      `vscode-ragdoll-ignorewalk-suite-${Date.now()}`,
    );
    testSuiteRootTempDir = vscode.Uri.file(rootPath);
    await createDirectory(testSuiteRootTempDir).catch(() => {
      /* Ignore if already exists */
    });
  });

  after(async () => {
    if (testSuiteRootTempDir) {
      try {
        await vscode.workspace.fs.delete(testSuiteRootTempDir, {
          recursive: true,
          useTrash: false,
        });
      } catch (error) {
        console.error(
          `Error cleaning up test suite root directory ${testSuiteRootTempDir.fsPath}:`,
          error,
        );
      }
    }
  });

  beforeEach(async () => {
    const testDirName = `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    currentTestTempDirUri = vscode.Uri.joinPath(
      testSuiteRootTempDir,
      testDirName,
    );
    await createDirectory(currentTestTempDirUri);
  });

  it("should return an empty array for an empty directory", async () => {
    const options: IgnoreWalkOptions = { dir: currentTestTempDirUri };
    const result = await ignoreWalk(options);
    assert.deepStrictEqual(result, []);
  });

  it("should list all files and directories when no .gitignore is present", async () => {
    const file1Uri = vscode.Uri.joinPath(currentTestTempDirUri, "file1.txt");
    await createFile(file1Uri, "content1");
    const folder1Uri = vscode.Uri.joinPath(currentTestTempDirUri, "folder1");
    await createDirectory(folder1Uri);
    const file2Uri = vscode.Uri.joinPath(folder1Uri, "file2.txt");
    await createFile(file2Uri, "content2");

    const options: IgnoreWalkOptions = {
      dir: currentTestTempDirUri,
      recursive: true,
    };
    const result = await ignoreWalk(options);

    const expected: FileResult[] = [
      { uri: file1Uri, relativePath: "file1.txt", isDir: false },
      { uri: folder1Uri, relativePath: "folder1", isDir: true },
      {
        uri: file2Uri,
        relativePath: _path.join("folder1", "file2.txt"),
        isDir: false,
      },
    ];
    assert.deepStrictEqual(
      normalizeResults(result),
      normalizeResults(expected),
    );
  });

  it("should ignore files and directories specified in .gitignore", async () => {
    const gitignoreUri = vscode.Uri.joinPath(
      currentTestTempDirUri,
      ".gitignore",
    );
    await createFile(gitignoreUri, "ignored-file.txt\nignored-folder/");

    const file1Uri = vscode.Uri.joinPath(currentTestTempDirUri, "file1.txt");
    await createFile(file1Uri);
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "ignored-file.txt"),
    );

    const folder1Uri = vscode.Uri.joinPath(currentTestTempDirUri, "folder1");
    await createDirectory(folder1Uri);
    await createFile(vscode.Uri.joinPath(folder1Uri, "file2.txt"));

    const ignoredFolderUri = vscode.Uri.joinPath(
      currentTestTempDirUri,
      "ignored-folder",
    );
    await createDirectory(ignoredFolderUri);
    await createFile(
      vscode.Uri.joinPath(ignoredFolderUri, "should-be-ignored.txt"),
    );

    const options: IgnoreWalkOptions = {
      dir: currentTestTempDirUri,
      recursive: true,
    };
    const result = await ignoreWalk(options);

    const expected: FileResult[] = [
      { uri: gitignoreUri, relativePath: ".gitignore", isDir: false }, // .gitignore itself is listed
      { uri: file1Uri, relativePath: "file1.txt", isDir: false },
      { uri: folder1Uri, relativePath: "folder1", isDir: true },
      {
        uri: vscode.Uri.joinPath(folder1Uri, "file2.txt"),
        relativePath: _path.join("folder1", "file2.txt"),
        isDir: false,
      },
      // 'ignored-folder' is listed because directories are listed even if their contents are ignored by a pattern like 'ignored-folder/'
      // However, its contents ('should-be-ignored.txt') are not listed.
      { uri: ignoredFolderUri, relativePath: "ignored-folder", isDir: true },
    ];
    assert.deepStrictEqual(
      normalizeResults(result),
      normalizeResults(expected),
    );
  });

  it("should handle non-recursive walk", async () => {
    const file1Uri = vscode.Uri.joinPath(currentTestTempDirUri, "file1.txt");
    await createFile(file1Uri);
    const folder1Uri = vscode.Uri.joinPath(currentTestTempDirUri, "folder1");
    await createDirectory(folder1Uri);
    await createFile(vscode.Uri.joinPath(folder1Uri, "file2.txt")); // This should not be listed

    const options: IgnoreWalkOptions = {
      dir: currentTestTempDirUri,
      recursive: false,
    };
    const result = await ignoreWalk(options);

    const expected: FileResult[] = [
      { uri: file1Uri, relativePath: "file1.txt", isDir: false },
      { uri: folder1Uri, relativePath: "folder1", isDir: true },
    ];
    assert.deepStrictEqual(
      normalizeResults(result),
      normalizeResults(expected),
    );
  });

  it("should list all items if count is less than MaxScanItems (10000)", async () => {
    const file1 = vscode.Uri.joinPath(currentTestTempDirUri, "file1.txt");
    const file2 = vscode.Uri.joinPath(currentTestTempDirUri, "file2.txt");
    const file3 = vscode.Uri.joinPath(currentTestTempDirUri, "file3.txt");
    await createFile(file1);
    await createFile(file2);
    await createFile(file3);

    const options: IgnoreWalkOptions = { dir: currentTestTempDirUri };
    const result = await ignoreWalk(options);

    assert.strictEqual(
      result.length,
      3,
      "All 3 files should be returned as MaxScanItems is large",
    );
    const expected: FileResult[] = [
      { uri: file1, relativePath: "file1.txt", isDir: false },
      { uri: file2, relativePath: "file2.txt", isDir: false },
      { uri: file3, relativePath: "file3.txt", isDir: false },
    ];
    assert.deepStrictEqual(
      normalizeResults(result),
      normalizeResults(expected),
    );
  });

  it("should handle abort signal", async () => {
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, "file1.txt"));
    const abortController = new AbortController();
    const options: IgnoreWalkOptions = {
      dir: currentTestTempDirUri,
      abortSignal: abortController.signal,
    };

    abortController.abort();
    const result = await ignoreWalk(options);
    assert.deepStrictEqual(
      result,
      [],
      "Should return empty if aborted before start",
    );
  });

  it("should correctly parse .gitignore rules with comments and empty lines", async () => {
    const gitignoreUri = vscode.Uri.joinPath(
      currentTestTempDirUri,
      ".gitignore",
    );
    await createFile(
      gitignoreUri,
      "# This is a comment\n\nignored.txt\n   # Another comment with leading spaces\n",
    );

    const fileTxtUri = vscode.Uri.joinPath(currentTestTempDirUri, "file.txt");
    await createFile(fileTxtUri);
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, "ignored.txt"));

    const options: IgnoreWalkOptions = { dir: currentTestTempDirUri };
    const result = await ignoreWalk(options);
    const expected: FileResult[] = [
      { uri: gitignoreUri, relativePath: ".gitignore", isDir: false }, // .gitignore itself is listed
      { uri: fileTxtUri, relativePath: "file.txt", isDir: false },
    ];
    assert.deepStrictEqual(
      normalizeResults(result),
      normalizeResults(expected),
    );
  });

  it("should handle nested .gitignore files", async () => {
    const rootGitignoreUri = vscode.Uri.joinPath(
      currentTestTempDirUri,
      ".gitignore",
    );
    await createFile(rootGitignoreUri, "root-ignored.txt\nfolder1/");

    const fileTxtUri = vscode.Uri.joinPath(currentTestTempDirUri, "file.txt");
    await createFile(fileTxtUri); // Kept
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "root-ignored.txt"),
    ); // Ignored by root

    const folder1Uri = vscode.Uri.joinPath(currentTestTempDirUri, "folder1"); // Ignored by root, but the folder itself is listed
    await createDirectory(folder1Uri);
    await createFile(vscode.Uri.joinPath(folder1Uri, "in-folder1.txt"));

    const folder2Uri = vscode.Uri.joinPath(currentTestTempDirUri, "folder2"); // Kept
    await createDirectory(folder2Uri);
    const folder2GitignoreUri = vscode.Uri.joinPath(folder2Uri, ".gitignore");
    await createFile(folder2GitignoreUri, "nested-ignored.txt");
    const anotherFileUri = vscode.Uri.joinPath(folder2Uri, "another-file.txt");
    await createFile(anotherFileUri); // Kept
    await createFile(vscode.Uri.joinPath(folder2Uri, "nested-ignored.txt")); // Ignored by folder2/.gitignore

    const options: IgnoreWalkOptions = {
      dir: currentTestTempDirUri,
      recursive: true,
    };
    const result = await ignoreWalk(options);

    const expected: FileResult[] = [
      { uri: rootGitignoreUri, relativePath: ".gitignore", isDir: false },
      { uri: fileTxtUri, relativePath: "file.txt", isDir: false },
      { uri: folder1Uri, relativePath: "folder1", isDir: true }, // folder1 itself is listed
      { uri: folder2Uri, relativePath: "folder2", isDir: true },
      {
        uri: folder2GitignoreUri,
        relativePath: _path.join("folder2", ".gitignore"),
        isDir: false,
      },
      {
        uri: anotherFileUri,
        relativePath: _path.join("folder2", "another-file.txt"),
        isDir: false,
      },
    ];
    assert.deepStrictEqual(
      normalizeResults(result),
      normalizeResults(expected),
    );
  });

  it("should correctly handle ignore patterns for files in subdirectories", async () => {
    const gitignoreUri = vscode.Uri.joinPath(
      currentTestTempDirUri,
      ".gitignore",
    );
    await createFile(gitignoreUri, "folder/specific-file.txt\n*.log");

    const file1TxtUri = vscode.Uri.joinPath(currentTestTempDirUri, "file1.txt");
    await createFile(file1TxtUri);
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "activity.log"),
    ); // Ignored by *.log

    const folderUri = vscode.Uri.joinPath(currentTestTempDirUri, "folder");
    await createDirectory(folderUri);
    const anotherTxtUri = vscode.Uri.joinPath(folderUri, "another.txt");
    await createFile(anotherTxtUri);
    await createFile(vscode.Uri.joinPath(folderUri, "specific-file.txt")); // Ignored by folder/specific-file.txt
    await createFile(vscode.Uri.joinPath(folderUri, "debug.log")); // Ignored by *.log

    const options: IgnoreWalkOptions = {
      dir: currentTestTempDirUri,
      recursive: true,
    };
    const result = await ignoreWalk(options);

    const expected: FileResult[] = [
      { uri: gitignoreUri, relativePath: ".gitignore", isDir: false }, // .gitignore itself is listed
      { uri: file1TxtUri, relativePath: "file1.txt", isDir: false },
      { uri: folderUri, relativePath: "folder", isDir: true },
      {
        uri: anotherTxtUri,
        relativePath: _path.join("folder", "another.txt"),
        isDir: false,
      },
    ];
    assert.deepStrictEqual(
      normalizeResults(result),
      normalizeResults(expected),
    );
  });

  it("should list all files if .gitignore is unreadable/missing (effectively no ignore rules from it)", async () => {
    // No .gitignore file is created for this test.
    const file1Uri = vscode.Uri.joinPath(currentTestTempDirUri, "file1.txt");
    await createFile(file1Uri);
    const sensitiveLogUri = vscode.Uri.joinPath(
      currentTestTempDirUri,
      "sensitive.log",
    );
    await createFile(sensitiveLogUri); // This would be ignored if a *.log rule was active and read

    const options: IgnoreWalkOptions = { dir: currentTestTempDirUri };
    const result = await ignoreWalk(options);

    const expected: FileResult[] = [
      { uri: file1Uri, relativePath: "file1.txt", isDir: false },
      { uri: sensitiveLogUri, relativePath: "sensitive.log", isDir: false },
    ];
    assert.deepStrictEqual(
      normalizeResults(result),
      normalizeResults(expected),
    );
  });
});
