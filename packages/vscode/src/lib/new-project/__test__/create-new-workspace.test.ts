import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { beforeEach, afterEach, suite, test } from 'mocha';
import proxyquire from 'proxyquire';
import * as fsUtils from '../../fs'; // Import for type, and original for setup/teardown

suite('createNewWorkspace Suite', () => {
    let showInputBoxStub: sinon.SinonStub;
    let isFileExistsStub: sinon.SinonStub; 
    let createDirectoryStub: sinon.SinonStub;
    let proxiedCreateNewWorkspace: typeof import('../utils').createNewWorkspace;
    let originalIsFileExists: typeof fsUtils.isFileExists;

    const testRunId = `test-${Date.now()}`;
    const rootTestDir = vscode.Uri.file(`/tmp/pochi-vscode-tests/${testRunId}`);

    const testHomeEnv = process.env.VSCODE_TEST_HOME || process.env.HOME;
    const actualHomeForTest = vscode.Uri.file(testHomeEnv || `/tmp/test-home-fallback-${testRunId}`);
    const actualBasePochiProjectsUri = vscode.Uri.joinPath(actualHomeForTest, 'PochiProjects');

    beforeEach(async () => {
        originalIsFileExists = fsUtils.isFileExists;

        showInputBoxStub = sinon.stub(); 
        isFileExistsStub = sinon.stub(); 
        createDirectoryStub = sinon.stub().resolves();

        const utils = proxyquire('../utils', {
            'vscode': {
                Uri: vscode.Uri, 
                window: {
                    showInputBox: showInputBoxStub,
                },
                workspace: {
                    fs: {
                        createDirectory: createDirectoryStub,
                    }
                },
            },
            '../fs': { 
                isFileExists: isFileExistsStub,
            }
        });
        proxiedCreateNewWorkspace = utils.createNewWorkspace;

        if (await originalIsFileExists(rootTestDir)) {
            await vscode.workspace.fs.delete(rootTestDir, { recursive: true, useTrash: false });
        }
        await vscode.workspace.fs.createDirectory(rootTestDir);
    });

    afterEach(async () => {
        sinon.restore(); 
        if (await originalIsFileExists(rootTestDir)) {
            await vscode.workspace.fs.delete(rootTestDir, { recursive: true, useTrash: false });
        }

        if (actualBasePochiProjectsUri.fsPath.startsWith('/tmp/')) {
            const wasPochiProjectsDirAttempted = createDirectoryStub.getCalls().some(call => 
                call.args[0] && call.args[0].fsPath === actualBasePochiProjectsUri.fsPath
            );
            if (wasPochiProjectsDirAttempted && await originalIsFileExists(actualBasePochiProjectsUri)) {
                try {
                    await vscode.workspace.fs.delete(actualBasePochiProjectsUri, { recursive: true, useTrash: false });
                } catch (e) {
                    console.warn(`Test Cleanup: Could not delete ${actualBasePochiProjectsUri.fsPath}: ${e}`);
                }
            }
        }
    });

    test('should create a new workspace in PochiProjects, assuming PochiProjects itself already exists', async () => {
        const projectName = 'my-new-project';
        const expectedProjectUri = vscode.Uri.joinPath(actualBasePochiProjectsUri, projectName);

        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === actualBasePochiProjectsUri.fsPath)).resolves(true);
        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === expectedProjectUri.fsPath)).resolves(false);
        isFileExistsStub.resolves(false); // Default fallback

        showInputBoxStub.resolves(projectName);

        const resultUri = await proxiedCreateNewWorkspace();

        assert.ok(resultUri, 'Project URI should be returned');
        assert.strictEqual(resultUri!.fsPath, expectedProjectUri.fsPath, 'Project URI fsPath should match');
        
        assert.ok(
            createDirectoryStub.calledWith(sinon.match((uri: vscode.Uri) => uri.fsPath === expectedProjectUri.fsPath)),
            `createDirectory stub should have been called for ${expectedProjectUri.fsPath}`
        );
        assert.ok(showInputBoxStub.calledOnce, 'showInputBox should be called once');
        // Check that createDirectory was NOT called for actualBasePochiProjectsUri because it was stubbed to exist
        const callsForBaseUri = createDirectoryStub.getCalls().filter(call => call.args[0].fsPath === actualBasePochiProjectsUri.fsPath);
        assert.strictEqual(callsForBaseUri.length, 0, 'createDirectory should NOT be called for actualBasePochiProjectsUri if it already exists');
    });
    
    test('should create PochiProjects in HOME if it does not exist, then create project', async () => {
        const projectName = 'my-project-in-new-home-pochi';
        const expectedProjectUri = vscode.Uri.joinPath(actualBasePochiProjectsUri, projectName);

        // PochiProjects in HOME does NOT exist
        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === actualBasePochiProjectsUri.fsPath)).resolves(false);
        // Target project directory does NOT exist
        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === expectedProjectUri.fsPath)).resolves(false);
        isFileExistsStub.resolves(false); // Default fallback

        showInputBoxStub.resolves(projectName);

        const resultUri = await proxiedCreateNewWorkspace();

        assert.ok(resultUri, 'Project URI should be returned');
        assert.strictEqual(resultUri!.fsPath, expectedProjectUri.fsPath, 'Project URI fsPath should match');

        assert.ok(
            createDirectoryStub.calledWith(sinon.match((uri: vscode.Uri) => uri.fsPath === actualBasePochiProjectsUri.fsPath)),
            `createDirectory stub for PochiProjects directory ${actualBasePochiProjectsUri.fsPath} should have been called`
        );
        assert.ok(
            createDirectoryStub.calledWith(sinon.match((uri: vscode.Uri) => uri.fsPath === expectedProjectUri.fsPath)),
            `createDirectory stub for project directory ${expectedProjectUri.fsPath} should have been called`
        );
    });

    test('should use provided placeholder name if accepted', async () => {
        const placeholderName = 'custom-placeholder';
        const expectedProjectUri = vscode.Uri.joinPath(actualBasePochiProjectsUri, placeholderName);

        isFileExistsStub.withArgs(actualBasePochiProjectsUri).resolves(true);
        isFileExistsStub.withArgs(expectedProjectUri).resolves(false);
        isFileExistsStub.resolves(false); // Default fallback

        showInputBoxStub.callsFake(async (options) => {
            assert.strictEqual(options?.value, placeholderName, "Input box value should be the placeholder");
            return options?.value; 
        });

        const resultUri = await proxiedCreateNewWorkspace(placeholderName);

        assert.ok(resultUri, "Project URI should be returned");
        assert.strictEqual(resultUri!.fsPath, expectedProjectUri.fsPath, "Project URI fsPath should match placeholder");
        assert.ok(showInputBoxStub.calledOnce, "showInputBox should be called once");
        assert.ok(createDirectoryStub.calledWith(sinon.match((uri: vscode.Uri) => uri.fsPath === expectedProjectUri.fsPath)), "Project directory should be created with placeholder name");
    });

    test('should return undefined if project name input is cancelled', async () => {
        // PochiProjects dir exists
        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === actualBasePochiProjectsUri.fsPath)).resolves(true); 
        // Fallback for any other isFileExists calls, though not expected for this test flow for createDirectory
        isFileExistsStub.resolves(false); 
        
        showInputBoxStub.resolves(undefined); // User cancels input

        const resultUri = await proxiedCreateNewWorkspace();

        assert.strictEqual(resultUri, undefined, "Result URI should be undefined");
        assert.ok(showInputBoxStub.calledOnce, "showInputBox should be called once");
        
        // Given isFileExistsStub(actualBasePochiProjectsUri) resolves true, 
        // createDirectoryIfNotExists(actualBasePochiProjectsUri) should NOT call createDirectoryStub.
        // No other directories should be created either since projectName is undefined.
        assert.strictEqual(createDirectoryStub.callCount, 0, 'createDirectoryStub should not have been called at all in this scenario');
    });

    test('should return error via validateInput if project directory already exists', async () => {
        const existingProjectName = 'existing-project';
        const projectPathInPochiProjects = vscode.Uri.joinPath(actualBasePochiProjectsUri, existingProjectName);

        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === actualBasePochiProjectsUri.fsPath)).resolves(true);
        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === projectPathInPochiProjects.fsPath)).resolves(true);
        isFileExistsStub.resolves(false); // Default fallback

        let validator: ((value: string) => Promise<string | undefined | null>) | undefined;
        showInputBoxStub.callsFake(async (options) => {
            validator = options?.validateInput as any;
            if (validator) {
                const validationResult = await validator(existingProjectName);
                assert.strictEqual(validationResult, "Project directory already exists, please choose another name", "Validation should fail if project directory already exists");
            }
            return undefined; 
        });

        const resultUri = await proxiedCreateNewWorkspace();

        assert.strictEqual(resultUri, undefined, "Result URI should be undefined as input was cancelled after validation error");
        assert.ok(showInputBoxStub.calledOnce, 'showInputBox should be called once');
        assert.ok(validator, "validateInput function should have been passed to showInputBox");
        // createDirectoryStub should not be called because validation failed and input was cancelled.
        // The check for actualBasePochiProjectsUri happens before input, and it exists, so no call for that either.
        assert.strictEqual(createDirectoryStub.callCount, 0, 'createDirectoryStub should not have been called');
    });

    test('should call validateInput for project name and pass for valid name', async () => {
        const validName = 'valid-name';
        const projectToValidateUri = vscode.Uri.joinPath(actualBasePochiProjectsUri, validName);
        const expectedProjectUri = vscode.Uri.joinPath(actualBasePochiProjectsUri, validName);

        // PochiProjects exists
        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === actualBasePochiProjectsUri.fsPath)).resolves(true);
        // Project to be created does not exist (for validator and for creation)
        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === projectToValidateUri.fsPath)).resolves(false);
        // Default for other isFileExists calls (e.g. for another-existing project name check)
        isFileExistsStub.resolves(false); 

        let validator: ((value: string) => Promise<string | undefined | null>) | undefined;
        showInputBoxStub.callsFake(async (options) => {
            validator = options?.validateInput as any;
            if (validator) {
                assert.strictEqual(await validator("invalid name!"), "Project name can only contain letters, numbers, dashes and underscores", "Validation should fail for invalid name with spaces");
                assert.strictEqual(await validator("invalid@name"), "Project name can only contain letters, numbers, dashes and underscores", "Validation should fail for invalid name with @");
                assert.strictEqual(await validator(""), "Project name cannot be empty", "Validation should fail for empty name");
                
                const anotherExistingProjectName = 'another-existing';
                const anotherExistingProjectUri = vscode.Uri.joinPath(actualBasePochiProjectsUri, anotherExistingProjectName);
                // Crucially, for this specific sub-test inside validator, make this one exist
                isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === anotherExistingProjectUri.fsPath)).resolves(true);
                assert.strictEqual(await validator(anotherExistingProjectName), "Project directory already exists, please choose another name", "Validation should fail for another existing name");
                
                // Reset for the validName check to ensure it's seen as not existing
                isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === projectToValidateUri.fsPath)).resolves(false);
                assert.strictEqual(await validator(validName), undefined, "Validation should pass for valid name");
            }
            return validName; 
        });

        const resultUri = await proxiedCreateNewWorkspace();
        
        assert.ok(resultUri, "Project URI should be returned");
        assert.strictEqual(resultUri!.fsPath, expectedProjectUri.fsPath, "Project URI fsPath should match");
        assert.ok(showInputBoxStub.calledOnce, "showInputBox should be called once");
        assert.ok(validator, "validateInput function should have been passed to showInputBox");
        assert.ok(createDirectoryStub.calledWith(sinon.match((uri: vscode.Uri) => uri.fsPath === expectedProjectUri.fsPath)), "Project directory should be created with valid name");
        // Ensure PochiProjects dir itself wasn't created again
        const callsForBaseUri = createDirectoryStub.getCalls().filter(call => call.args[0].fsPath === actualBasePochiProjectsUri.fsPath);
        assert.strictEqual(callsForBaseUri.length, 0, 'createDirectory should NOT be called for actualBasePochiProjectsUri as it was stubbed to exist');
    });
});

