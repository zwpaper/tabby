import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { beforeEach, afterEach, suite, test } from 'mocha';
import { createNewWorkspace } from '../utils';
import * as fsModule from '../../fs'; // For stubbing isFileExists

suite('createNewWorkspace Suite', () => {
    let showOpenDialogStub: sinon.SinonStub;
    let showInputBoxStub: sinon.SinonStub;
    let isFileExistsStub: sinon.SinonStub;
    let originalIsFileExists: typeof fsModule.isFileExists; // To store the original

    const testRunId = `test-${Date.now()}`;
    const rootTestDir = vscode.Uri.file(`/tmp/pochi-vscode-tests/${testRunId}`);
    const pochiProjectsDirInTest = vscode.Uri.joinPath(rootTestDir, 'PochiProjects');

    const testHomeEnv = process.env.VSCODE_TEST_HOME || process.env.HOME;
    const actualHomeForTest = vscode.Uri.file(testHomeEnv || `/tmp/test-home-fallback-${testRunId}`);
    const actualBasePochiProjectsUri = vscode.Uri.joinPath(actualHomeForTest, 'PochiProjects');

    beforeEach(async () => {
        originalIsFileExists = fsModule.isFileExists; // Store original before stubbing
        showOpenDialogStub = sinon.stub(vscode.window, 'showOpenDialog');
        showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
        isFileExistsStub = sinon.stub(fsModule, 'isFileExists');
        

        if (await originalIsFileExists(rootTestDir)) {
            await vscode.workspace.fs.delete(rootTestDir, { recursive: true, useTrash: false });
        }
        await vscode.workspace.fs.createDirectory(rootTestDir);
        await vscode.workspace.fs.createDirectory(pochiProjectsDirInTest);
    });

    afterEach(async () => {
        // Capture isFileExistsStub calls for actualBasePochiProjectsUri *before* sinon.restore()
        let wasStubbedAsNonExistentForCleanup = false;
        for (const call of isFileExistsStub.getCalls()) {
            if (call.args[0].fsPath === actualBasePochiProjectsUri.fsPath) {
                const returnValue = await call.returnValue; // Ensure promise is resolved if it's a promise
                if (returnValue === false) {
                    wasStubbedAsNonExistentForCleanup = true;
                    break;
                }
            }
        }

        sinon.restore(); // This will restore fsModule.isFileExists to originalIsFileExists
        
        // Cleanup rootTestDir using the now original fsModule.isFileExists
        if (await fsModule.isFileExists(rootTestDir)) { 
            await vscode.workspace.fs.delete(rootTestDir, { recursive: true, useTrash: false });
        }
        
        // Best-effort cleanup for actualBasePochiProjectsUri if it's in /tmp and was potentially created by the test
        if (actualBasePochiProjectsUri.fsPath.startsWith('/tmp/') && wasStubbedAsNonExistentForCleanup && await fsModule.isFileExists(actualBasePochiProjectsUri) ) {
                 try {
                    await vscode.workspace.fs.delete(actualBasePochiProjectsUri, { recursive: true, useTrash: false });
                 } catch (e) {
                    console.warn(`Test: Could not clean up ${actualBasePochiProjectsUri.fsPath}: ${e}`);
                 }
        }
    });

    test('should create a new workspace, assuming PochiProjects in HOME already exists', async () => {
        const selectedParentDir = vscode.Uri.joinPath(pochiProjectsDirInTest, 'selectedParent');
        await vscode.workspace.fs.createDirectory(selectedParentDir); 

        const projectName = 'my-new-project';
        const expectedProjectUri = vscode.Uri.joinPath(selectedParentDir, projectName);

        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === actualBasePochiProjectsUri.fsPath)).resolves(true);
        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === expectedProjectUri.fsPath)).resolves(false);
        isFileExistsStub.resolves(true);

        showOpenDialogStub.resolves([selectedParentDir]);
        showInputBoxStub.resolves(projectName);

        const resultUri = await createNewWorkspace();

        assert.ok(resultUri, 'Project URI should be returned');
        assert.strictEqual(resultUri!.fsPath, expectedProjectUri.fsPath, 'Project URI fsPath should match');
        
        const projectExists = await originalIsFileExists(expectedProjectUri);
        assert.ok(projectExists, `Project directory ${expectedProjectUri.fsPath} should have been created`);
        
        assert.ok(showOpenDialogStub.calledOnce, 'showOpenDialog should be called once');
        assert.deepStrictEqual(showOpenDialogStub.firstCall.args[0].defaultUri.fsPath, actualBasePochiProjectsUri.fsPath, 'showOpenDialog defaultUri should be actualBasePochiProjectsUri');
        assert.ok(showInputBoxStub.calledOnce, 'showInputBox should be called once');
    });
    
    test('should create PochiProjects in HOME if it does not exist, then create project', async () => {
        const selectedParentDir = vscode.Uri.joinPath(pochiProjectsDirInTest, 'selectedParentForNewHome');
        await vscode.workspace.fs.createDirectory(selectedParentDir);

        const projectName = 'my-project-in-new-home-pochi';
        const expectedProjectUri = vscode.Uri.joinPath(selectedParentDir, projectName);

        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === actualBasePochiProjectsUri.fsPath)).resolves(false);
        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === expectedProjectUri.fsPath)).resolves(false);
        isFileExistsStub.resolves(true);

        showOpenDialogStub.resolves([selectedParentDir]);
        showInputBoxStub.resolves(projectName);

        const resultUri = await createNewWorkspace();

        assert.ok(resultUri);
        assert.strictEqual(resultUri!.fsPath, expectedProjectUri.fsPath);

        const homePochiProjectsExists = await originalIsFileExists(actualBasePochiProjectsUri);
        assert.ok(homePochiProjectsExists, `PochiProjects directory ${actualBasePochiProjectsUri.fsPath} should have been created in HOME`);

        const projectExists = await originalIsFileExists(expectedProjectUri);
        assert.ok(projectExists, `Project directory ${expectedProjectUri.fsPath} should have been created`);
    });

    test('should use provided placeholder name if accepted', async () => {
        const selectedParentDir = vscode.Uri.joinPath(pochiProjectsDirInTest, 'placeholderParent');
        await vscode.workspace.fs.createDirectory(selectedParentDir);
        const placeholderName = 'custom-placeholder';
        const expectedProjectUri = vscode.Uri.joinPath(selectedParentDir, placeholderName);

        isFileExistsStub.withArgs(actualBasePochiProjectsUri).resolves(true);
        isFileExistsStub.withArgs(expectedProjectUri).resolves(false);

        showOpenDialogStub.resolves([selectedParentDir]);
        showInputBoxStub.callsFake(async (options) => {
            assert.strictEqual(options?.value, placeholderName);
            return options?.value; 
        });

        const resultUri = await createNewWorkspace(placeholderName);

        assert.ok(resultUri);
        assert.strictEqual(resultUri!.fsPath, expectedProjectUri.fsPath);
        assert.ok(showInputBoxStub.calledOnce);
        const projectExists = await originalIsFileExists(expectedProjectUri);
        assert.ok(projectExists, "Project directory should be created with placeholder name");
    });

    test('should return undefined if parent directory selection is cancelled', async () => {
        isFileExistsStub.withArgs(actualBasePochiProjectsUri).resolves(true);
        showOpenDialogStub.resolves(undefined); 

        const resultUri = await createNewWorkspace();

        assert.strictEqual(resultUri, undefined);
        assert.ok(showOpenDialogStub.calledOnce);
        assert.ok(showInputBoxStub.notCalled);
    });

    test('should return undefined if project name input is cancelled', async () => {
        const selectedParentDir = vscode.Uri.joinPath(pochiProjectsDirInTest, 'cancelInputParent');
        await vscode.workspace.fs.createDirectory(selectedParentDir);
        isFileExistsStub.withArgs(actualBasePochiProjectsUri).resolves(true);
        showOpenDialogStub.resolves([selectedParentDir]);
        showInputBoxStub.resolves(undefined); 

        const resultUri = await createNewWorkspace();

        assert.strictEqual(resultUri, undefined);
        assert.ok(showOpenDialogStub.calledOnce);
        assert.ok(showInputBoxStub.calledOnce);
    });

    test('should call validateInput for project name and pass for valid name', async () => {
        const selectedParentDir = vscode.Uri.joinPath(pochiProjectsDirInTest, 'validationParent');
        await vscode.workspace.fs.createDirectory(selectedParentDir);
        const validName = 'valid-name';
        const expectedProjectUri = vscode.Uri.joinPath(selectedParentDir, validName);

        isFileExistsStub.withArgs(actualBasePochiProjectsUri).resolves(true);
        isFileExistsStub.withArgs(expectedProjectUri).resolves(false);

        showOpenDialogStub.resolves([selectedParentDir]);
        let validator: ((value: string) => string | undefined | null) | undefined;
        showInputBoxStub.callsFake(async (options) => {
            validator = options?.validateInput;
            if (validator) {
                assert.strictEqual(validator("invalid name!"), "Project name can only contain letters, numbers, dashes and underscores", "Validation should fail for invalid name with spaces");
                assert.strictEqual(validator("invalid@name"), "Project name can only contain letters, numbers, dashes and underscores", "Validation should fail for invalid name with @");
                assert.strictEqual(validator(""), "Project name cannot be empty", "Validation should fail for empty name");
                assert.strictEqual(validator(validName), undefined, "Validation should pass for valid name");
            }
            return validName; 
        });

        const resultUri = await createNewWorkspace();
        
        assert.ok(resultUri);
        assert.strictEqual(resultUri!.fsPath, expectedProjectUri.fsPath);
        assert.ok(showInputBoxStub.calledOnce);
        assert.ok(validator, "validateInput function should have been passed to showInputBox");
        const projectExists = await originalIsFileExists(expectedProjectUri);
        assert.ok(projectExists, "Project directory should be created with valid name");
    });
});

