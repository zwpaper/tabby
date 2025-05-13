import * as assert from "assert";
import * as os from "node:os";
import * as _path from "node:path"; // Renamed to avoid conflict if 'path' is used as a var name
import { after, before, beforeEach, describe, it } from "mocha";
import * as vscode from "vscode";
import proxyquire from "proxyquire";
import { searchFiles } from "../search-files";
// import { getWorkspaceFolder } from "@/lib/fs"; // Original import

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
  toolCallId: "test-call-id-search",
  messages: [], // Provide a minimal message object
};

describe("searchFiles Tool", () => {
  let testSuiteRootTempDir: vscode.Uri;
  let currentTestTempDirUri: vscode.Uri;
  let currentTestTempDirRelativePath: string;
  let searchFilesWithMock: typeof searchFiles;

  before(async () => {
    const rootPath = _path.join(
      os.tmpdir(),
      `vscode-ragdoll-searchfiles-suite-${Date.now()}`,
    );
    testSuiteRootTempDir = vscode.Uri.file(rootPath);
    await createDirectory(testSuiteRootTempDir).catch(() => {
      /* Ignore if already exists */
    });

    // Mock getWorkspaceFolder to return our test root temp dir
    const fsMock = {
      getWorkspaceFolder: () => ({
        uri: testSuiteRootTempDir,
        name: "test-workspace",
        index: 0,
      }),
    };
    searchFilesWithMock = proxyquire("../search-files", {
      "@/lib/fs": fsMock,
    }).searchFiles;
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
    const testDirName = `test-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    currentTestTempDirRelativePath = testDirName;
    currentTestTempDirUri = vscode.Uri.joinPath(
      testSuiteRootTempDir,
      testDirName,
    );
    await createDirectory(currentTestTempDirUri);
  });

  it("should return an empty array for an empty directory", async () => {
    const result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "anything" },
      dummyToolOptions,
    );
    assert.deepStrictEqual(result.matches, []);
  });

  it("should return an empty array if no files match the regex", async () => {
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "file1.txt"),
      "hello world",
    );
    const result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "nonexistent" },
      dummyToolOptions,
    );
    assert.deepStrictEqual(result.matches, []);
  });

  it("should find matches in a single file", async () => {
    const fileName = "file1.txt";
    const expectedFilePath = _path.join(testSuiteRootTempDir.fsPath, currentTestTempDirRelativePath, fileName);
    const fileUri = vscode.Uri.joinPath(currentTestTempDirUri, fileName);
    const content = "line 1\nline 2 has the keyword\nline 3";
    await createFile(fileUri, content);

    const result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "keyword" },
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 1);
    assert.strictEqual(result.matches[0].file, expectedFilePath);
    assert.strictEqual(result.matches[0].line, 2);
    assert.strictEqual(result.matches[0].context, "line 2 has the keyword");
  });

  it("should find matches in multiple files", async () => {
    const fileName1 = "file1.txt";
    const fileName2 = "file2.log";
    const expectedFilePath1 = _path.join(testSuiteRootTempDir.fsPath, currentTestTempDirRelativePath, fileName1);
    const expectedFilePath2 = _path.join(testSuiteRootTempDir.fsPath, currentTestTempDirRelativePath, fileName2);

    const content1 = "keyword in file1";
    const content2 = "another keyword here";
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, fileName1), content1);
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, fileName2), content2);

    const result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "keyword" },
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 2);
    const resultFiles = result.matches.map((r: any) => r.file).sort();
    assert.deepStrictEqual(resultFiles, [expectedFilePath1, expectedFilePath2].sort());
  });

  it("should find matches using filePattern", async () => {
    const fileName1 = "file1.txt";
    const expectedFilePath1 = _path.join(testSuiteRootTempDir.fsPath, currentTestTempDirRelativePath, fileName1);
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, fileName1), "keyword");
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, "file2.log"), "keyword");
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, "file3.txt"), "no match");

    const result = await searchFilesWithMock(
      {
        path: currentTestTempDirRelativePath,
        regex: "keyword",
        filePattern: "*.txt", 
      },
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 1);
    assert.strictEqual(result.matches[0].file, expectedFilePath1);
  });

  it("should find multiple matches in the same file on different lines", async () => {
    const fileName = "file.txt";
    const expectedFilePath = _path.join(testSuiteRootTempDir.fsPath, currentTestTempDirRelativePath, fileName);
    const content = "keyword on line 1\nno match\nkeyword on line 3";
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, fileName), content);

    const result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "keyword" },
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 2);
    assert.strictEqual(result.matches[0].file, expectedFilePath);
    assert.strictEqual(result.matches[0].line, 1);
    assert.strictEqual(result.matches[1].file, expectedFilePath);
    assert.strictEqual(result.matches[1].line, 3);
  });
  
  it("should find multiple matches in the same file on the same line (ripgrep behavior)", async () => {
    const fileName = "file.txt";
    const expectedFilePath = _path.join(testSuiteRootTempDir.fsPath, currentTestTempDirRelativePath, fileName);
    const content = "keyword keyword";
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, fileName), content);

    const result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "keyword" },
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 1); 
    assert.strictEqual(result.matches[0].file, expectedFilePath);
    assert.strictEqual(result.matches[0].line, 1);
    assert.strictEqual(result.matches[0].context, "keyword keyword");
  });


  it("should handle regex special characters", async () => {
    const fileName = "file.txt";
    const content = "line with (parentheses) and [brackets].";
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, fileName), content);

    const result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "\\(parentheses\\)" }, 
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 1);
    assert.strictEqual(result.matches[0].context, "line with (parentheses) and [brackets].");
  });

  it("should be case sensitive by default", async () => {
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, "file.txt"), "Keyword");
    const result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "keyword" },
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 0);

    const resultCaps = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "Keyword" },
      dummyToolOptions,
    );
    assert.strictEqual(resultCaps.matches.length, 1);
  });
  
  it("should handle case insensitive search with regex flag", async () => {
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, "file.txt"), "Keyword");
    const result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "(?i)keyword" }, 
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 1);
    assert.strictEqual(result.matches[0].context, "Keyword");
  });

  it("should not provide context lines (before and after) with current implementation", async () => {
    const fileName = "file.txt";
    const content = "line A\nline B (target)\nline C\nline D";
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, fileName), content);

    const result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "target" },
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 1);
    const match = result.matches[0];
    assert.strictEqual(match.line, 2);
    assert.strictEqual(match.context, "line B (target)");
    assert.strictEqual((match as any).contextBefore, undefined);
    assert.strictEqual((match as any).contextAfter, undefined);
  });
  
  it("should not throw an error for valid absolute paths that are within the workspace context", async () => {
    // This test verifies that if an absolute path is constructed and used (which rg will get),
    // and that path points to a file within the mocked workspace, it should still work.
    const fileName = "abs_file.txt";
    const absolutePathToSearchFile = _path.join(testSuiteRootTempDir.fsPath, currentTestTempDirRelativePath, fileName);
    await createFile(vscode.Uri.file(absolutePathToSearchFile), "absolute content");

    // We are searching within `currentTestTempDirRelativePath`
    // The file `abs_file.txt` is inside it.
    const result = await searchFilesWithMock(
      { 
        path: currentTestTempDirRelativePath, // Search path is relative to workspace
        regex: "absolute content"
      },
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 1);
    assert.strictEqual(result.matches[0].file, absolutePathToSearchFile);
    assert.strictEqual(result.matches[0].context, "absolute content");
  });
  
  it("should throw an error for invalid regex", async () => {
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, "file1.txt"), "content");
    try {
      await searchFilesWithMock(
        { path: currentTestTempDirRelativePath, regex: "[" }, // Invalid regex
        dummyToolOptions,
      );
      assert.fail("Should have thrown an error for invalid regex");
    } catch (error: any) {
      assert.ok(
        error.message.toLowerCase().includes("regex") || error.message.toLowerCase().includes("pattern") || error.message.toLowerCase().includes("ripgrep failed"),
        `Unexpected error message for invalid regex: ${error.message}`
      );
    }
  });

  it("should handle abort signal", async () => {
    await createFile(
      vscode.Uri.joinPath(currentTestTempDirUri, "file1.txt"),
      "content that could be found",
    );
    const abortController = new AbortController();
    const promise = searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "content" },
      { ...dummyToolOptions, abortSignal: abortController.signal },
    );
    abortController.abort();
    try {
      await promise;
    } catch (error: any) {
      assert.ok(
        error.name === "AbortError" || 
        error.message.includes("aborted") ||
        error.message.includes("cancelled") || 
        (error.message.includes("process") && error.message.includes("terminated")) ||
        error.message.includes("The operation was aborted"), 
        `Unexpected error on abort: ${error.name} - ${error.message}`
      );
    }
  });
  
  it("should search in subdirectories", async () => {
    const subDirName = "subdir";
    const rootFileName = "root.txt";
    const subFileName = "sub.txt";

    const expectedRootFilePath = _path.join(testSuiteRootTempDir.fsPath, currentTestTempDirRelativePath, rootFileName);
    const expectedSubFilePath = _path.join(testSuiteRootTempDir.fsPath, currentTestTempDirRelativePath, subDirName, subFileName);

    const subDirUri = vscode.Uri.joinPath(currentTestTempDirUri, subDirName);
    await createDirectory(subDirUri);
    
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, rootFileName), "keyword in root");
    await createFile(vscode.Uri.joinPath(subDirUri, subFileName), "keyword in subdir");

    const result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "keyword" },
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 2);
    const filesFound = result.matches.map((r: any) => r.file).sort();
    assert.deepStrictEqual(filesFound, [expectedRootFilePath, expectedSubFilePath].sort());
  });

  it("should correctly interpret filePattern with subdirectories", async () => {
    const subDir1 = "dir1";
    const subDir2 = "dir2";
    const fileA = "fileA.md";
    const fileB = "fileB.txt";
    const fileC = "fileC.md";
    const rootFile = "root.md";

    const expectedFileAPath = _path.join(testSuiteRootTempDir.fsPath, currentTestTempDirRelativePath, subDir1, fileA);
    const expectedFileBPath = _path.join(testSuiteRootTempDir.fsPath, currentTestTempDirRelativePath, subDir1, fileB);
    const expectedFileCPath = _path.join(testSuiteRootTempDir.fsPath, currentTestTempDirRelativePath, subDir2, fileC);
    const expectedRootFilePath = _path.join(testSuiteRootTempDir.fsPath, currentTestTempDirRelativePath, rootFile);

    await createDirectory(vscode.Uri.joinPath(currentTestTempDirUri, subDir1));
    await createDirectory(vscode.Uri.joinPath(currentTestTempDirUri, subDir2));

    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, subDir1, fileA), "findme");
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, subDir1, fileB), "findme");
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, subDir2, fileC), "findme");
    await createFile(vscode.Uri.joinPath(currentTestTempDirUri, rootFile), "findme");

    let result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "findme", filePattern: "*.md" },
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 3);
    let files = result.matches.map((r: any) => r.file).sort();
    assert.deepStrictEqual(files, [expectedFileAPath, expectedFileCPath, expectedRootFilePath].sort());
    
    result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "findme", filePattern: `**/${subDir1}/${fileA}` }, 
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 1);
    assert.strictEqual(result.matches[0].file, expectedFileAPath);

    result = await searchFilesWithMock(
      { path: currentTestTempDirRelativePath, regex: "findme", filePattern: `**/*.txt` },
      dummyToolOptions,
    );
    assert.strictEqual(result.matches.length, 1);
    assert.strictEqual(result.matches[0].file, expectedFileBPath);
  });

});

