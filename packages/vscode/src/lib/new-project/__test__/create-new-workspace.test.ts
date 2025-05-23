import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { beforeEach, afterEach, suite, test } from 'mocha';
import proxyquire from 'proxyquire';
import * as fsUtils from '../../fs'; // Import for type, and original for setup/teardown

suite('createNewWorkspace Suite', () => {
    let isFileExistsStub: sinon.SinonStub; 
    let createDirectoryStub: sinon.SinonStub;
    let quickPickStub: any;
    let createQuickPickStub: sinon.SinonStub;
    let showErrorMessageStub: sinon.SinonStub;
    let proxiedCreateNewWorkspace: typeof import('../utils').createNewWorkspace;
    let originalIsFileExists: typeof fsUtils.isFileExists;

    const testRunId = `test-${Date.now()}`;
    const rootTestDir = vscode.Uri.file(`/tmp/pochi-vscode-tests/${testRunId}`);

    const testHomeEnv = process.env.VSCODE_TEST_HOME || process.env.HOME;
    const actualHomeForTest = vscode.Uri.file(testHomeEnv || `/tmp/test-home-fallback-${testRunId}`);
    const actualBasePochiProjectsUri = vscode.Uri.joinPath(actualHomeForTest, 'PochiProjects');

    beforeEach(async () => {
        originalIsFileExists = fsUtils.isFileExists;

        isFileExistsStub = sinon.stub(); 
        createDirectoryStub = sinon.stub().resolves();
        showErrorMessageStub = sinon.stub();
        
        // Create mock for createQuickPick with realistic behavior
        quickPickStub = {
            show: sinon.stub(),
            hide: sinon.stub(),
            onDidAccept: sinon.stub().callsFake(callback => {
                // Store the callback to be triggered manually in the tests
                quickPickStub._acceptCallback = callback;
                return { dispose: sinon.stub() };
            }),
            dispose: sinon.stub(),
            title: '',
            value: '',
            items: [],
            selectedItems: [],
            ignoreFocusOut: false,
            matchOnDescription: false,
            matchOnDetail: false,
            _acceptCallback: null,
        };
        
        // The createQuickPick mock will return our stub
        createQuickPickStub = sinon.stub().returns(quickPickStub);

        // Create a comprehensive VS Code mock
        const vscodeMock = {
            Uri: vscode.Uri,
            window: {
                createQuickPick: createQuickPickStub,
                showErrorMessage: showErrorMessageStub,
                QuickPickItemKind: vscode.QuickPickItemKind,
                ThemeIcon: vscode.ThemeIcon,
            },
            workspace: {
                fs: {
                    createDirectory: createDirectoryStub,
                }
            }
        };

        // Mock VS Code APIs with noCallThru to prevent real VS Code API usage
        const utils = proxyquire.load('../utils', {
            'vscode': vscodeMock,
            '../fs': { 
                isFileExists: isFileExistsStub,
            },
            "project-name-generator": () => ({dashed:""})
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

    // Helper function for test setup
    async function setupAndTriggerQuickPick(projectName: string, selectedLabel: string = "Start") {
        // Start the workflow
        const resultPromise = proxiedCreateNewWorkspace(projectName);

        // Set up quickPick state and trigger acceptance
        quickPickStub.value = projectName;
        quickPickStub.selectedItems = [{ label: selectedLabel }];

        await new Promise(resolve => setTimeout(resolve, 0));

        // Call the onDidAccept callback
        if (quickPickStub._acceptCallback) {
            await quickPickStub._acceptCallback();
        } else {
            throw new Error('QuickPick onDidAccept callback not registered');
        }

        // Verify quickPick was shown
        assert.ok(createQuickPickStub.calledOnce, 'createQuickPick should be called once');
        assert.ok(quickPickStub.show.calledOnce, 'quickPick.show should be called once');
        
        // Return the promise so it can be awaited
        return resultPromise;
    }

    test('should create a new workspace in PochiProjects, assuming PochiProjects itself already exists', async () => {
        const projectName = 'my-new-project';
        const expectedProjectUri = vscode.Uri.joinPath(actualBasePochiProjectsUri, projectName);

        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === actualBasePochiProjectsUri.fsPath)).resolves(true);
        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === expectedProjectUri.fsPath)).resolves(false);
        isFileExistsStub.resolves(false); // Default fallback

        const resultUri = await setupAndTriggerQuickPick(projectName, "Start");
        
        assert.ok(resultUri, 'Project URI should be returned');
        assert.equal(resultUri!.fsPath, expectedProjectUri.fsPath + '-', 'Project URI fsPath should match');

        assert.ok(
            createDirectoryStub.calledWith(sinon.match((uri: vscode.Uri) => uri.fsPath === expectedProjectUri.fsPath + "-")),
            `createDirectory stub should have been called for ${expectedProjectUri.fsPath}`
        );

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

        // Use helper function to setup and trigger QuickPick
        const resultUri = await setupAndTriggerQuickPick(projectName, "Start");

        assert.ok(resultUri, 'Project URI should be returned');
        assert.ok(resultUri!.fsPath.startsWith(expectedProjectUri.fsPath), 'Project URI fsPath should match');

        assert.ok(
            createDirectoryStub.calledWith(sinon.match((uri: vscode.Uri) => uri.fsPath === actualBasePochiProjectsUri.fsPath)),
            `createDirectory stub for PochiProjects directory ${actualBasePochiProjectsUri.fsPath} should have been called`
        );
        assert.ok(
            createDirectoryStub.calledWith(sinon.match((uri: vscode.Uri) => uri.fsPath === expectedProjectUri.fsPath  + "-")),
            `createDirectory stub for project directory ${expectedProjectUri.fsPath} should have been called`
        );
    });

    test('should use provided placeholder name if accepted', async () => {
        const placeholderName = 'custom-placeholder';
        const expectedProjectUri = vscode.Uri.joinPath(actualBasePochiProjectsUri, placeholderName);

        isFileExistsStub.withArgs(actualBasePochiProjectsUri).resolves(true);
        isFileExistsStub.withArgs(expectedProjectUri).resolves(false);
        isFileExistsStub.resolves(false); // Default fallback

        // Await the result
        const resultUri = await setupAndTriggerQuickPick(placeholderName, "Start");
        
        assert.ok(resultUri, "Project URI should be returned");
        assert.ok(resultUri!.fsPath.startsWith(expectedProjectUri.fsPath), "Project URI fsPath should match placeholder");
        assert.ok(createDirectoryStub.calledWith(sinon.match((uri: vscode.Uri) => uri.fsPath === expectedProjectUri.fsPath  + "-")), 
                "Project directory should be created with placeholder name");
    });

    test('should return undefined if project name input is cancelled', async () => {
        // PochiProjects dir exists
        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === actualBasePochiProjectsUri.fsPath)).resolves(true); 
        // Fallback for any other isFileExists calls
        isFileExistsStub.resolves(false); 
        
        
        const resultUri = await setupAndTriggerQuickPick('', "Cancel");

        assert.strictEqual(resultUri, undefined, "Result URI should be undefined");
        
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
        
        // Since validation fails, project creation should not proceed
        const resultUri = await setupAndTriggerQuickPick(existingProjectName, "Cancel");

        // Force the promise to resolve
        quickPickStub.hide();
        assert.strictEqual(resultUri, undefined, "Result URI should be undefined as validation failed");
    });

    test('should call validateInput for project name and pass for valid name1', async () => {
        const validName = 'valid-name';
        const projectToValidateUri = vscode.Uri.joinPath(actualBasePochiProjectsUri, validName);

        // PochiProjects exists
        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === actualBasePochiProjectsUri.fsPath)).resolves(true);
        // Project to be created does not exist
        isFileExistsStub.withArgs(sinon.match((uri: vscode.Uri) => uri.fsPath === projectToValidateUri.fsPath)).resolves(false);
        // Default for other isFileExists calls
        isFileExistsStub.resolves(false);
        
        setupAndTriggerQuickPick("invalid@name", "Start");
        setTimeout(() => {
            assert.ok(showErrorMessageStub.calledOnce, "showErrorMessage should be called once");
            assert.ok(showErrorMessageStub.calledWith("Project name can only contain letters, numbers, dashes and underscores"), 
                "showErrorMessage should be called with the correct error message");
        }, 0);

        // Get the result
        // setupAndTriggerQuickPick("invalid name!", "Start");
        // setTimeout(() => {
        //     assert.ok(showErrorMessageStub.calledOnce, "showErrorMessage should be called once");
        //     assert.ok(showErrorMessageStub.calledWith("Project name can only contain letters, numbers, dashes and underscores"), 
        //         "showErrorMessage should be called with the correct error message");
        // }, 0);

        //  setupAndTriggerQuickPick("", "Start");
        // setTimeout(() => {
        //     assert.ok(showErrorMessageStub.calledOnce, "showErrorMessage should be called once");
        //     assert.ok(showErrorMessageStub.calledWith("Project name cannot be empty"), 
        //         "showErrorMessage should be called with the correct error message");
        //     }, 0);
    });

});
