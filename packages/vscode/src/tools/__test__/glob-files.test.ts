import * as assert from "assert";
import * as os from "node:os";
import * as _path from "node:path"; // Renamed to avoid conflict if 'path' is used as a var name
import { after, before, beforeEach, describe, it } from "mocha";
import * as vscode from "vscode";
import { globFiles } from "../glob-files";
import { getWorkspaceFolder } from "@/lib/fs";

// Helper to create a file
async function createFile(uri: vscode.Uri, content = ""): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
}

// Helper to create a directory
async function createDirectory(uri: vscode.Uri): Promise<void> {
  await vscode.workspace.fs.createDirectory(uri);
}

// Dummy options for tool execution context
const dummyToolOptions = {
  toolCallId: "test-call-id-123",
  messages: [], // Provide a minimal message object
};


describe("globFiles Tool", () => {
  let testSuiteRootTempDir: vscode.Uri;
  let currentTestTempDirUri: vscode.Uri;
  let currentTestTempDirRelativePath: string;

  before(async () => {
    const rootPath = _path.join(
      os.tmpdir(),
      `vscode-ragdoll-globfiles-suite-${Date.now()}`,
    );
    testSuiteRootTempDir = vscode.Uri.file(rootPath);
    await createDirectory(testSuiteRootTempDir).catch(() => {
      /* Ignore if already exists */
    });

    // Mock getWorkspaceFolder to return our test root temp dir
    (getWorkspaceFolder as any) = () => ({
      uri: testSuiteRootTempDir,
      name: "test-workspace",
      index: 0,
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
    currentTestTempDirRelativePath = testDirName;
    currentTestTempDirUri = vscode.Uri.joinPath(
      testSuiteRootTempDir,
      testDirName,
    );
    await createDirectory(currentTestTempDirUri);
  });

  it("should return an empty array for an empty directory", async () => {
    const result = await globFiles(
      { path: currentTestTempDirRelativePath, globPattern: "*.txt" },
      dummyToolOptions,
    );
    assert.deepStrictEqual(result.files, []);
    assert.strictEqual(result.isTruncated, false);
  });

  it("should list files matching a simple pattern", async () => {
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "file1.txt"),
      "content1",
    );
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "file2.ts"),
      "content2",
    );
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "another.txt"),
      "content3",
    );

    const result = await globFiles(
      { path: currentTestTempDirRelativePath, globPattern: "*.txt" },
      dummyToolOptions,
    );
    assert.deepStrictEqual(result.files.sort(), ["another.txt", "file1.txt"]);
    assert.strictEqual(result.isTruncated, false);
  });

  it("should list files matching a wildcard pattern in subdirectories", async () => {
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "file1.txt"),
    );
    const subDir1 = vscode.Uri.joinPath(currentTestTempDirUri, "sub1");
    await createDirectory(subDir1);
    await createFile(vscode.Uri.joinPath(subDir1, "file2.txt"));
    await createFile(vscode.Uri.joinPath(subDir1, "image.jpg"));

    const subDir2 = vscode.Uri.joinPath(currentTestTempDirUri, "sub2");
    await createDirectory(subDir2);
    await createFile(vscode.Uri.joinPath(subDir2, "file3.txt"));
    await createFile(vscode.Uri.joinPath(subDir2, "archive.zip"));

    const result = await globFiles(
      { path: currentTestTempDirRelativePath, globPattern: "**/*.txt" },
      dummyToolOptions,
    );
    assert.deepStrictEqual(
      result.files.sort(),
      ["file1.txt", "sub1/file2.txt", "sub2/file3.txt"].sort(),
    );
    assert.strictEqual(result.isTruncated, false);
  });

  it("should return an empty array if no files match the pattern", async () => {
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "file1.ts"),
    );
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "file2.js"),
    );

    const result = await globFiles(
      { path: currentTestTempDirRelativePath, globPattern: "*.txt" },
      dummyToolOptions,
    );
    assert.deepStrictEqual(result.files, []);
    assert.strictEqual(result.isTruncated, false);
  });

  it("should throw an error for absolute paths", async () => {
    const absolutePath = _path.resolve(currentTestTempDirUri.fsPath);
    try {
      await globFiles({ path: absolutePath, globPattern: "*.txt" }, dummyToolOptions);
      assert.fail("Should have thrown an error for absolute path");
    } catch (error: any) {
      assert.ok(
        error.message.includes("Absolute paths are not supported"),
        `Unexpected error message: ${error.message}`,
      );
    }
  });

  it("should handle abort signal", async () => {
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "file1.txt"),
    );
    const abortController = new AbortController();
    const promise = globFiles(
      { path: currentTestTempDirRelativePath, globPattern: "*.txt" },
      { ...dummyToolOptions, abortSignal: abortController.signal },
    );
    abortController.abort();
    try {
      await promise;
      // Depending on timing, it might complete before abort is processed or throw.
      // If it completes, the result might be empty or partial.
      // If it throws, it should be an AbortError or similar.
      // For this test, we'll accept that it doesn't hang and doesn't throw an unexpected error.
    } catch (error: any) {
      // In Node.js, AbortController.abort() causes the promise to reject with a DOMException 'AbortError'
      // In VS Code extension host, it might behave differently or be wrapped.
      // We check if the error name or message indicates an abort.
      assert.ok(
        error.name === "AbortError" ||
        error.message.includes("aborted") ||
        error.message.includes("cancelled"), // ignoreWalk might throw "cancelled"
        `Unexpected error on abort: ${error.name} - ${error.message}`,
      );
    }
  });

  it("should correctly handle patterns with directory names", async () => {
    const subDir = vscode.Uri.joinPath(currentTestTempDirUri, "targetdir");
    await createDirectory(subDir);
    await createFile(vscode.Uri.joinPath(subDir, "fileA.txt"));
    await createFile(vscode.Uri.joinPath(subDir, "fileB.md"));

    const otherDir = vscode.Uri.joinPath(currentTestTempDirUri, "otherdir");
    await createDirectory(otherDir);
    await createFile(vscode.Uri.joinPath(otherDir, "fileC.txt"));

    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, "rootfile.txt"));


    let result = await globFiles(
      { path: currentTestTempDirRelativePath, globPattern: "targetdir/*.txt" },
      dummyToolOptions,
    );
    assert.deepStrictEqual(result.files.sort(), ["targetdir/fileA.txt"]);
    assert.strictEqual(result.isTruncated, false);

    result = await globFiles(
      { path: currentTestTempDirRelativePath, globPattern: "**/fileA.txt" },
      dummyToolOptions,
    );
    assert.deepStrictEqual(result.files.sort(), ["targetdir/fileA.txt"]);
    assert.strictEqual(result.isTruncated, false);

    result = await globFiles(
      { path: currentTestTempDirRelativePath, globPattern: "otherdir/*"},
      dummyToolOptions,
    );
    assert.deepStrictEqual(result.files.sort(), ["otherdir/fileC.txt"]);
     assert.strictEqual(result.isTruncated, false);
  });

  it("should be case-insensitive for glob patterns", async () => {
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "File.TXT"),
    );
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "document.txt"),
    );
     await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "IMAGE.JPG"),
    );

    const result = await globFiles(
      { path: currentTestTempDirRelativePath, globPattern: "*.txt" },
      dummyToolOptions,
    );
    assert.deepStrictEqual(result.files.sort(), ["File.TXT", "document.txt"].sort());
    assert.strictEqual(result.isTruncated, false);

    const resultJpg = await globFiles(
      { path: currentTestTempDirRelativePath, globPattern: "*.jpg" },
      dummyToolOptions,
    );
    assert.deepStrictEqual(resultJpg.files.sort(), ["IMAGE.JPG"]);
    assert.strictEqual(resultJpg.isTruncated, false);
  });

});

