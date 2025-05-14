import * as assert from "assert";
import * as vscode from "vscode";
import sinon from "sinon";
import proxyquire from "proxyquire";
import * as nodePath from "node:path";
import * as nodeOs from "node:os";
import { beforeEach, describe, it, afterEach, before, after } from "mocha";

// Assuming env.ts exports functions like getSystemInfo, collectCustomRules
import * as envModuleType from "../env";

// Helper to create a file
async function createFile(uri: vscode.Uri, content = ""): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
}

// Helper to create a directory
async function createDirectory(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.createDirectory(uri);
  } catch (error) {
    if (error instanceof vscode.FileSystemError && error.code === "FileExists") {
      // console.warn(`Directory already exists: ${uri.fsPath}`);
    } else {
      // console.warn(`Failed to create directory ${uri.fsPath}:`, error);
    }
  }
}

describe("env.ts", () => {
  let testSuiteRootTempDir: vscode.Uri;
  let currentTestTempDirUri: vscode.Uri;
  let testWorkspaceUri: vscode.Uri;
  let testHomeDirUri: vscode.Uri; // Simulated home directory for tests (used by collectCustomRules)

  let env: typeof envModuleType;
  let mockOsHomedirStub: sinon.SinonStub;
  
  let mockVscodeWindowShowErrorStub: sinon.SinonStub;
  let mockVscodeWindowShowInfoStub: sinon.SinonStub;
  let mockVscodeWindowWithProgressStub: sinon.SinonStub;

  let originalProcessPlatform: NodeJS.Platform;

  before(async () => {
    const rootPath = nodePath.join(
      nodeOs.tmpdir(),
      `vscode-ragdoll-env-suite-${Date.now()}`
    );
    testSuiteRootTempDir = vscode.Uri.file(rootPath);
    await createDirectory(testSuiteRootTempDir);

    originalProcessPlatform = process.platform; // Store original platform

    mockOsHomedirStub = sinon.stub();
    mockVscodeWindowShowErrorStub = sinon.stub();
    mockVscodeWindowShowInfoStub = sinon.stub();
    mockVscodeWindowWithProgressStub = sinon.stub().callsFake(async (_options, task) => {
        return await task({ report: sinon.stub() }, { isCancellationRequested: false, onCancellationRequested: sinon.stub() });
    });

    const vscodeStub = {
      Uri: vscode.Uri,
      workspace: {
        fs: vscode.workspace.fs,
        get workspaceFolders() {
          return currentTestWorkspaceFolders;
        },
      },
      window: {
        showErrorMessage: mockVscodeWindowShowErrorStub,
        showInformationMessage: mockVscodeWindowShowInfoStub,
        withProgress: mockVscodeWindowWithProgressStub,
      },
      ProgressLocation: vscode.ProgressLocation,
    };

    const nodeOsStub = {
      ...require("node:os"),
      homedir: mockOsHomedirStub,
    };

    const proxiedEnv = proxyquire("../env", {
      "vscode": vscodeStub,
      "node:fs": require("node:fs"),
      "node:os": nodeOsStub,
    });
    env = proxiedEnv as typeof envModuleType;
  });

  after(async () => {
    if (testSuiteRootTempDir) {
      try {
        await vscode.workspace.fs.delete(testSuiteRootTempDir, { recursive: true, useTrash: false });
      } catch (error) {
        console.error(`Failed to delete test suite root temp dir: ${testSuiteRootTempDir.fsPath}`, error);
      }
    }
    Object.defineProperty(process, "platform", {
      value: originalProcessPlatform,
      writable: true,
    });
  });

  let originalProcessEnv: NodeJS.ProcessEnv;
  let originalProcessCwd: () => string;
  let currentTestWorkspaceFolders: vscode.WorkspaceFolder[] | undefined;

  beforeEach(async () => {
    originalProcessEnv = { ...process.env };
    originalProcessCwd = process.cwd;
    Object.defineProperty(process, "platform", {
      value: originalProcessPlatform,
      writable: true,
    });

    const testDirName = `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    currentTestTempDirUri = vscode.Uri.joinPath(testSuiteRootTempDir, testDirName);
    await createDirectory(currentTestTempDirUri);

    testWorkspaceUri = vscode.Uri.joinPath(currentTestTempDirUri, "workspace");
    await createDirectory(testWorkspaceUri);
    currentTestWorkspaceFolders = [{ uri: testWorkspaceUri, name: "test-workspace", index: 0 }];

    // Default stub for os.homedir() for collectCustomRules and other tests if needed
    testHomeDirUri = vscode.Uri.joinPath(currentTestTempDirUri, "home");
    await createDirectory(testHomeDirUri);
    mockOsHomedirStub.returns(testHomeDirUri.fsPath);

    mockOsHomedirStub.resetHistory(); // Reset history for all stubs
    mockVscodeWindowShowErrorStub.resetHistory();
    mockVscodeWindowShowInfoStub.resetHistory();
    mockVscodeWindowWithProgressStub.resetHistory();
  });

  afterEach(async () => {
    process.env = originalProcessEnv;
    process.cwd = originalProcessCwd;
    currentTestWorkspaceFolders = undefined;

    if (currentTestTempDirUri) {
      try {
        await vscode.workspace.fs.delete(currentTestTempDirUri, { recursive: true, useTrash: false });
      } catch (error) {
        console.error(`Failed to delete current test temp dir: ${currentTestTempDirUri.fsPath}`, error);
      }
    }
  });

  describe("getSystemInfo", () => {
    const MOCK_HOMEDIR_FOR_GETSYSTEMINFO = "/mock/user/home";

    beforeEach(() => {
      // Override os.homedir() stub specifically for getSystemInfo tests
      // This will be reset for each test within this describe block.
      mockOsHomedirStub.returns(MOCK_HOMEDIR_FOR_GETSYSTEMINFO);
    });

    it("should return system info with vscode workspace", () => {
      Object.defineProperty(process, "platform", { value: "darwin", writable: true });
      process.env.SHELL = "/bin/zsh";

      const info = env.getSystemInfo();
      assert.deepStrictEqual(info, {
        cwd: testWorkspaceUri.fsPath,
        shell: "/bin/zsh",
        os: "darwin",
        homedir: MOCK_HOMEDIR_FOR_GETSYSTEMINFO,
      });
    });

    it("should return system info using process.cwd if workspaceFolders is undefined", () => {
      Object.defineProperty(process, "platform", { value: "linux", writable: true });
      process.env.SHELL = "/bin/bash";
      process.cwd = () => "/current/dir_process";
      currentTestWorkspaceFolders = undefined;

      const info = env.getSystemInfo();
      assert.deepStrictEqual(info, {
        cwd: "/current/dir_process",
        shell: "/bin/bash",
        os: "linux",
        homedir: MOCK_HOMEDIR_FOR_GETSYSTEMINFO,
      });
    });

    it("should return system info using process.cwd if workspaceFolders is empty", () => {
      Object.defineProperty(process, "platform", { value: "win32", writable: true });
      const MOCK_WINDOWS_HOMEDIR = "C:\\Users\\TestUser";
      mockOsHomedirStub.returns(MOCK_WINDOWS_HOMEDIR); // Re-stub for this specific test case
      process.env.SHELL = "powershell.exe";
      process.cwd = () => "C:\\project_process";
      currentTestWorkspaceFolders = [];

      const info = env.getSystemInfo();
      assert.deepStrictEqual(info, {
        cwd: "C:\\project_process",
        shell: "powershell.exe",
        os: "win32",
        homedir: MOCK_WINDOWS_HOMEDIR, // Expecting Windows-style path
      });
    });
    
    it("should handle missing SHELL env variable", () => {
      Object.defineProperty(process, "platform", { value: "darwin", writable: true });
      delete process.env.SHELL;
      process.cwd = () => "/fallback/cwd_process";
      currentTestWorkspaceFolders = undefined;

      const info = env.getSystemInfo();
      assert.deepStrictEqual(info, {
        cwd: "/fallback/cwd_process",
        shell: "",
        os: "darwin",
        homedir: MOCK_HOMEDIR_FOR_GETSYSTEMINFO,
      });
    });
  });

  describe("collectCustomRules", () => {
    let workspaceReadmeUri: vscode.Uri;
    let homePochiDirUri: vscode.Uri;
    let homeReadmeUri: vscode.Uri;

    beforeEach(async () => {
      // This block will use the mockOsHomedirStub set by the main beforeEach,
      // which points to testHomeDirUri.fsPath, created from currentTestTempDirUri.
      workspaceReadmeUri = vscode.Uri.joinPath(testWorkspaceUri, "README.pochi.md");
      
      // testHomeDirUri is already set by the outer beforeEach to be currentTestTempDirUri/home
      // mockOsHomedirStub already returns testHomeDirUri.fsPath from the outer beforeEach
      homePochiDirUri = vscode.Uri.joinPath(testHomeDirUri, ".pochi"); 
      await createDirectory(homePochiDirUri);
      homeReadmeUri = vscode.Uri.joinPath(homePochiDirUri, "README.pochi.md");
    });

    it("should collect rules from workspace README.pochi.md", async () => {
      await createFile(workspaceReadmeUri, "workspace rule content");

      const rules = await env.collectCustomRules([]);
      const expectedRule = `# Rules from ${workspaceReadmeUri.fsPath}\nworkspace rule content`;
      assert.ok(rules.includes(expectedRule), `Rules should include workspace rule. Got: ${rules}`);
      assert.ok(!rules.includes(homeReadmeUri.fsPath), "Rules should not include home rule path if file not found.");
    });

    it("should collect rules from home ~/.pochi/README.pochi.md", async () => {
      await createFile(homeReadmeUri, "home rule content");

      const rules = await env.collectCustomRules([]);
      // homeReadmeUri is based on testHomeDirUri which mockOsHomedirStub points to for these tests.
      const expectedRule = `# Rules from ${homeReadmeUri.fsPath}\nhome rule content`;
      assert.ok(rules.includes(expectedRule), `Rules should include home rule. Got: ${rules}`);
      assert.ok(!rules.includes(workspaceReadmeUri.fsPath), "Rules should not include workspace rule path if file not found.");
    });

    it("should collect rules from custom rule files", async () => {
      const customRuleFile1Path = nodePath.join(currentTestTempDirUri.fsPath, "custom-rule-1.md");
      await createFile(vscode.Uri.file(customRuleFile1Path), "custom rule 1 content");

      const rules = await env.collectCustomRules([customRuleFile1Path]);
      const expectedRule = `# Rules from ${customRuleFile1Path}\ncustom rule 1 content`;
      assert.ok(rules.includes(expectedRule), `Rules should include custom rule 1. Got: ${rules}`);
    });

    it("should collect rules from two custom rule files", async () => {
      const customRuleFile1Path = nodePath.join(currentTestTempDirUri.fsPath, "custom-rule-A.md");
      const customRuleFile2Path = nodePath.join(currentTestTempDirUri.fsPath, "custom-rule-B.md");
      await createFile(vscode.Uri.file(customRuleFile1Path), "Rule A content");
      await createFile(vscode.Uri.file(customRuleFile2Path), "Rule B content");

      const rules = await env.collectCustomRules([customRuleFile1Path, customRuleFile2Path]);

      const expectedRule1 = `# Rules from ${customRuleFile1Path}\nRule A content`;
      const expectedRule2 = `# Rules from ${customRuleFile2Path}\nRule B content`;

      assert.ok(rules.includes(expectedRule1), `Rules should include custom rule A. Got: ${rules}`);
      assert.ok(rules.includes(expectedRule2), `Rules should include custom rule B. Got: ${rules}`);
      assert.ok(!rules.includes(workspaceReadmeUri.fsPath), "Rules should not include workspace rule path if not created.");
      assert.ok(!rules.includes(homeReadmeUri.fsPath), "Rules should not include home rule path if not created.");
    });

    it("should collect rules from all sources", async () => {
      await createFile(workspaceReadmeUri, "ws rule");
      await createFile(homeReadmeUri, "home rule");
      const customRuleFile1Path = nodePath.join(currentTestTempDirUri.fsPath, "custom-rule-C.md"); // Changed name to avoid conflict
      await createFile(vscode.Uri.file(customRuleFile1Path), "custom C");

      const rules = await env.collectCustomRules([customRuleFile1Path]);
      assert.ok(rules.includes(`# Rules from ${workspaceReadmeUri.fsPath}\nws rule`));
      assert.ok(rules.includes(`# Rules from ${homeReadmeUri.fsPath}\nhome rule`));
      assert.ok(rules.includes(`# Rules from ${customRuleFile1Path}\ncustom C`));
    });

    it("should return empty string if no rules are found", async () => {
      const rules = await env.collectCustomRules([]);
      assert.strictEqual(rules, "");
    });

    it("should handle error when reading workspace README.pochi.md but still load others", async () => {
      await createFile(homeReadmeUri, "home rule after ws error");

      const rules = await env.collectCustomRules([]);
      assert.ok(rules.includes(`# Rules from ${homeReadmeUri.fsPath}\nhome rule after ws error`));
      assert.ok(!rules.includes(workspaceReadmeUri.fsPath));
    });
    
    it("should handle error when reading home README.pochi.md but still load others", async () => {
      await createFile(workspaceReadmeUri, "ws rule before home error");

      const rules = await env.collectCustomRules([]);
      assert.ok(rules.includes(`# Rules from ${workspaceReadmeUri.fsPath}\nws rule before home error`));
      assert.ok(!rules.includes(homeReadmeUri.fsPath));
    });

    it("should handle error when reading a custom rule file but still load others", async () => {
      await createFile(workspaceReadmeUri, "ws rule before custom error");
      const customRuleNonExistent = nodePath.join(currentTestTempDirUri.fsPath, "non-existent-custom.md");
        
      const rules = await env.collectCustomRules([customRuleNonExistent]);
      assert.ok(rules.includes(`# Rules from ${workspaceReadmeUri.fsPath}\nws rule before custom error`));
      assert.ok(!rules.includes(customRuleNonExistent));

    });

    it("should not attempt to read workspace README if no workspace folders", async () => {
      currentTestWorkspaceFolders = undefined;
      await createFile(homeReadmeUri, "home rule no workspace");

      const rules = await env.collectCustomRules([]);
      assert.ok(rules.includes(`# Rules from ${homeReadmeUri.fsPath}\nhome rule no workspace`));
      assert.ok(!rules.includes("README.pochi.md") || rules.includes(homeReadmeUri.fsPath));
    });
  });
});

