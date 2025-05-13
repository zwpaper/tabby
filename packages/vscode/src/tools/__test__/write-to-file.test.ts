import * as assert from "assert";
import * as os from "node:os";
import * as _path from "node:path"; // Renamed to avoid conflict if 'path' is used as a var name
import { after, afterEach, before, beforeEach, describe, it } from "mocha";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { DiffView } from "@/integrations/editor/diff-view";
import { writeToFile, previewWriteToFile } from "../write-to-file";
import { getWorkspaceFolder  } from "@/lib/fs";


// Helper to create a directory
async function createDirectory(uri: vscode.Uri): Promise<void> {
  await vscode.workspace.fs.createDirectory(uri);
}

// Dummy options for tool execution context
const dummyToolOptions = {
  toolCallId: "test-call-id-123",
  messages: [], // Provide a minimal message object
};

describe("writeToFile Tool", () => {
  let testSuiteRootTempDir: vscode.Uri;
  let currentTestTempDirUri: vscode.Uri;
  let currentTestTempDirRelativePath: string;
  let sandbox: sinon.SinonSandbox;
  let diffViewGetStub: sinon.SinonStub;
  let diffViewGetOrCreateStub: sinon.SinonStub;
  let mockDiffView: any;
  let isFileExistsStub: sinon.SinonStub;

  before(async () => {
    const rootPath = _path.join(
      os.tmpdir(),
      `vscode-ragdoll-writetofile-suite-${Date.now()}`
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
          error
        );
      }
    }
  });

  beforeEach(async () => {
    // Create a unique test directory for each test
    const testDirName = `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    currentTestTempDirRelativePath = testDirName;
    currentTestTempDirUri = vscode.Uri.joinPath(
      testSuiteRootTempDir,
      testDirName
    );
    await createDirectory(currentTestTempDirUri);

    // Set up sinon sandbox for mocking
    sandbox = sinon.createSandbox();
    
    // Create mock DiffView with required methods
    mockDiffView = {
      update: sandbox.stub().resolves(),
      saveChanges: sandbox.stub().resolves({
        success: true,
        userEdits: undefined,
        autoFormattingEdits: undefined,
        newProblems: "",
      }),
    };

    // Stub DiffView.get and DiffView.getOrCreate
    diffViewGetStub = sandbox.stub(DiffView, "get").returns(mockDiffView);
    diffViewGetOrCreateStub = sandbox.stub(DiffView, "getOrCreate").resolves(mockDiffView);
    
    // Stub isFileExists but in a way that doesn't affect other tests
    // Instead of replacing the global function, we'll use a module-specific stub
    isFileExistsStub = sandbox.stub(require("@/lib/fs"), "isFileExists");
    isFileExistsStub.callsFake(async () => false); // Default to file not existing
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("previewWriteToFile", () => {
    it("should not proceed if path or content is undefined", async () => {
      await previewWriteToFile({ path: undefined, content: "test" }, { ...dummyToolOptions, state: "partial-call" });
      assert.strictEqual(diffViewGetOrCreateStub.called, false);

      await previewWriteToFile({ path: "test.txt", content: undefined }, { ...dummyToolOptions, state: "partial-call" });
      assert.strictEqual(diffViewGetOrCreateStub.called, false);
    });

    it("should create a diff view and update it with content for partial call", async () => {
      const testPath = `${currentTestTempDirRelativePath}/test.txt`;
      const testContent = "This is test content";
      
      await previewWriteToFile(
        { path: testPath, content: testContent },
        { ...dummyToolOptions, state: "partial-call" }
      );
      
      assert.strictEqual(diffViewGetOrCreateStub.calledOnce, true);
      assert.strictEqual(diffViewGetOrCreateStub.firstCall.args[0], dummyToolOptions.toolCallId);
      assert.strictEqual(diffViewGetOrCreateStub.firstCall.args[1], testPath);
      
      assert.strictEqual(mockDiffView.update.calledOnce, true);
      assert.strictEqual(mockDiffView.update.firstCall.args[0], testContent);
      assert.strictEqual(mockDiffView.update.firstCall.args[1], false); // isFinal should be false for partial call
    });

    it("should create a diff view and update it with content for final call", async () => {
      const testPath = `${currentTestTempDirRelativePath}/test.txt`;
      const testContent = "This is test content";
      
      await previewWriteToFile(
        { path: testPath, content: testContent },
        { ...dummyToolOptions, state: "call" }
      );
      
      assert.strictEqual(diffViewGetOrCreateStub.calledOnce, true);
      assert.strictEqual(mockDiffView.update.calledOnce, true);
      assert.strictEqual(mockDiffView.update.firstCall.args[1], true); // isFinal should be true for final call
    });

    it("should handle content with BOM character", async () => {
      const testPath = `${currentTestTempDirRelativePath}/test.txt`;
      const testContent = "\ufeffThis is content with BOM";
      
      await previewWriteToFile(
        { path: testPath, content: testContent },
        { ...dummyToolOptions, state: "call" }
      );
      
      assert.strictEqual(diffViewGetOrCreateStub.calledOnce, true);
      assert.strictEqual(mockDiffView.update.calledOnce, true);
      // The DiffView.update method should handle BOM character removal
      assert.strictEqual(mockDiffView.update.firstCall.args[0], testContent);
    });

    it("should handle null args", async () => {
      await previewWriteToFile(null, { ...dummyToolOptions, state: "partial-call" });
      assert.strictEqual(diffViewGetOrCreateStub.called, false);
    });

    it("should handle diffView.update failure", async () => {
      const testPath = `${currentTestTempDirRelativePath}/test.txt`;
      const testContent = "This is test content";
      
      mockDiffView.update.rejects(new Error("Update failed"));
      
      try {
        await previewWriteToFile(
          { path: testPath, content: testContent },
          { ...dummyToolOptions, state: "call" }
        );
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        assert.ok(error.message.includes("Update failed"));
      }
    });
  });

  describe("writeToFile", () => {
    it("should throw an error if diff view is not found", async () => {
      diffViewGetStub.returns(undefined);
      
      const testPath = `${currentTestTempDirRelativePath}/test.txt`;
      const testContent = "This is test content";
      
      try {
        await writeToFile({ path: testPath, content: testContent }, dummyToolOptions);
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        assert.ok(error.message.includes("User has closed the diff view"));
      }
    });

    it("should save changes and return the result", async () => {
      const testPath = `${currentTestTempDirRelativePath}/test.txt`;
      const testContent = "This is test content";
      
      const expectedResult = {
        success: true,
        userEdits: "some user edits",
        autoFormattingEdits: "some formatting edits",
        newProblems: "some problems",
      };
      
      mockDiffView.saveChanges.resolves(expectedResult);
      
      const result = await writeToFile(
        { path: testPath, content: testContent },
        dummyToolOptions
      );
      
      assert.strictEqual(diffViewGetStub.calledOnce, true);
      assert.strictEqual(diffViewGetStub.firstCall.args[0], dummyToolOptions.toolCallId);
      
      assert.strictEqual(mockDiffView.saveChanges.calledOnce, true);
      assert.strictEqual(mockDiffView.saveChanges.firstCall.args[0], testPath);
      assert.strictEqual(mockDiffView.saveChanges.firstCall.args[1], testContent);
      
      assert.deepStrictEqual(result, expectedResult);
    });

    it("should handle user edits in the result", async () => {
      const testPath = `${currentTestTempDirRelativePath}/test.txt`;
      const testContent = "This is test content";
      
      const expectedResult = {
        success: true,
        userEdits: "some user edits",
      };
      
      mockDiffView.saveChanges.resolves(expectedResult);
      
      const result = await writeToFile(
        { path: testPath, content: testContent },
        dummyToolOptions
      );
      
      assert.deepStrictEqual(result, expectedResult);
    });

    it("should handle auto-formatting edits in the result", async () => {
      const testPath = `${currentTestTempDirRelativePath}/test.txt`;
      const testContent = "This is test content";
      
      const expectedResult = {
        success: true,
        autoFormattingEdits: "some formatting edits",
      };
      
      mockDiffView.saveChanges.resolves(expectedResult);
      
      const result = await writeToFile(
        { path: testPath, content: testContent },
        dummyToolOptions
      );
      
      assert.deepStrictEqual(result, expectedResult);
    });

    it("should handle new problems in the result", async () => {
      const testPath = `${currentTestTempDirRelativePath}/test.txt`;
      const testContent = "This is test content";
      
      const expectedResult = {
        success: true,
        newProblems: "some problems",
      };
      
      mockDiffView.saveChanges.resolves(expectedResult);
      
      const result = await writeToFile(
        { path: testPath, content: testContent },
        dummyToolOptions
      );
      
      assert.deepStrictEqual(result, expectedResult);
    });

    it("should handle content with different line endings", async () => {
      const testPath = `${currentTestTempDirRelativePath}/test.txt`;
      const testContent = "Line 1\r\nLine 2\r\nLine 3";
      
      const expectedResult = {
        success: true,
      };
      
      mockDiffView.saveChanges.resolves(expectedResult);
      
      const result = await writeToFile(
        { path: testPath, content: testContent },
        dummyToolOptions
      );
      
      assert.strictEqual(mockDiffView.saveChanges.calledOnce, true);
      assert.strictEqual(mockDiffView.saveChanges.firstCall.args[1], testContent);
      assert.deepStrictEqual(result, expectedResult);
    });


    it("should handle content with BOM character", async () => {
      const testPath = `${currentTestTempDirRelativePath}/test.txt`;
      const testContent = "\ufeffThis is content with BOM";
      
      const expectedResult = {
        success: true,
      };
      
      mockDiffView.saveChanges.resolves(expectedResult);
      
      const result = await writeToFile(
        { path: testPath, content: testContent },
        dummyToolOptions
      );
      
      assert.strictEqual(mockDiffView.saveChanges.calledOnce, true);
      // The BOM character should be preserved in the content passed to saveChanges
      assert.strictEqual(mockDiffView.saveChanges.firstCall.args[1], testContent);
      assert.deepStrictEqual(result, expectedResult);
    });

    it("should handle nested directory paths", async () => {
      const nestedPath = `${currentTestTempDirRelativePath}/nested/dir/test.txt`;
      const testContent = "Content in nested directory";
      
      const expectedResult = {
        success: true,
      };
      
      mockDiffView.saveChanges.resolves(expectedResult);
      
      const result = await writeToFile(
        { path: nestedPath, content: testContent },
        dummyToolOptions
      );
      
      assert.strictEqual(mockDiffView.saveChanges.calledOnce, true);
      assert.strictEqual(mockDiffView.saveChanges.firstCall.args[0], nestedPath);
      assert.deepStrictEqual(result, expectedResult);
    });

    it("should handle diffView.saveChanges failure", async () => {
      const testPath = `${currentTestTempDirRelativePath}/test.txt`;
      const testContent = "This is test content";
      
      mockDiffView.saveChanges.rejects(new Error("Save failed"));
      
      try {
        await writeToFile({ path: testPath, content: testContent }, dummyToolOptions);
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        assert.ok(error.message.includes("Save failed"));
      }
    });
  });
});
