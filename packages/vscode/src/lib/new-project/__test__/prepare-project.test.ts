import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { afterEach, beforeEach, suite, test } from 'mocha';
import * as jszip from 'jszip';
import proxyquire from 'proxyquire';
import { isFileExists } from '../../fs'; // Using the actual isFileExists
import { Buffer } from 'buffer'; // Import Buffer

// Path to the module to test, relative to this test file
const utilsModulePath = '../utils';

suite('prepareProject Suite with Proxyquire', () => {
    let fetchStub: sinon.SinonStub;
    let jszipLoadAsyncStub: sinon.SinonStub; // This will be our stub for jszip.loadAsync
    let progressReportStub: sinon.SinonStub;
    let prepareProject: any; // Will hold the proxied function

    const testRunId = `test-prepare-proxyquire-${Date.now()}`;
    const baseTestDir = vscode.Uri.file(`/tmp/pochi-vscode-tests/${testRunId}`);
    const projectUri = vscode.Uri.joinPath(baseTestDir, 'my-test-project');
    const githubTemplateUrl = 'https://github.com/test-owner/test-repo';

    beforeEach(async () => {
        await vscode.workspace.fs.createDirectory(baseTestDir);
        await vscode.workspace.fs.createDirectory(projectUri);

        fetchStub = sinon.stub(global, 'fetch');
        progressReportStub = sinon.stub();
        jszipLoadAsyncStub = sinon.stub(); // Create the stub for jszip.loadAsync

        // Use proxyquire to load the utils module with a mocked jszip
        const utils = proxyquire(utilsModulePath, {
            jszip: {
                loadAsync: jszipLoadAsyncStub,
            },
        });
        prepareProject = utils.prepareProject;
    });

    afterEach(async () => {
        sinon.restore(); // Restores stubs created by sinon.stub, but not proxyquire mocks directly
        proxyquire.callThru(); // Cleans up proxyquire mocks
        try {
            if (await isFileExists(baseTestDir)) {
                await vscode.workspace.fs.delete(baseTestDir, { recursive: true, useTrash: false });
            }
        } catch (error) {
            console.warn(`Error cleaning up test directory ${baseTestDir.fsPath}:`, error);
        }
    });

    test('should fetch, extract with proxied jszip, and create actual files/dirs', async () => {
        const mockZipBuffer = new ArrayBuffer(8);
        // Ensure expected content is also a Buffer for deepStrictEqual with readFile result
        const file1Content = Buffer.from(new Uint8Array([1, 2, 3]));
        const file2Content = Buffer.from(new Uint8Array([4, 5, 6]));

        const mockZip = {
            files: {
                'test-repo-main/': { dir: true, async: sinon.stub().resolves(null) },
                // The mock for jszip file.async should still resolve with Uint8Array, 
                // as that's what jszip itself provides.
                'test-repo-main/file1.txt': { dir: false, async: sinon.stub().resolves(new Uint8Array([1,2,3])) },
                'test-repo-main/folderA/': { dir: true, async: sinon.stub().resolves(null) },
                'test-repo-main/folderA/file2.txt': { dir: false, async: sinon.stub().resolves(new Uint8Array([4,5,6])) },
            }
        };

        fetchStub.resolves({
            ok: true,
            arrayBuffer: sinon.stub().resolves(mockZipBuffer)
        } as unknown as Response);
        jszipLoadAsyncStub.resolves(mockZip as unknown as jszip); // Our proxied stub

        const progress = { report: progressReportStub };

        await prepareProject(projectUri, githubTemplateUrl, progress as any);

        assert.ok(fetchStub.calledOnce, 'fetch should be called once');
        const expectedZipUrl = 'https://github.com/test-owner/test-repo/archive/refs/heads/main.zip';
        assert.strictEqual(fetchStub.firstCall.args[0], expectedZipUrl, `Fetch URL should be ${expectedZipUrl}`);

        assert.ok(jszipLoadAsyncStub.calledOnceWith(mockZipBuffer), 'Proxied jszip.loadAsync should be called with the zip buffer');

        assert.ok(progressReportStub.calledWith({ message: 'Pochi: Fetching project template...' }), 'Progress report for fetching');
        assert.ok(progressReportStub.calledWith({ message: 'Pochi: Extracting project template...' }), 'Progress report for extracting');

        const folderAUri = vscode.Uri.joinPath(projectUri, 'folderA');
        const file1Uri = vscode.Uri.joinPath(projectUri, 'file1.txt');
        const file2Uri = vscode.Uri.joinPath(projectUri, 'folderA', 'file2.txt');

        assert.ok(await isFileExists(folderAUri), `Directory ${folderAUri.fsPath} should exist`);
        assert.ok(await isFileExists(file1Uri), `File ${file1Uri.fsPath} should exist`);
        assert.ok(await isFileExists(file2Uri), `File ${file2Uri.fsPath} should exist`);

        const file1Data = await vscode.workspace.fs.readFile(file1Uri);
        assert.deepStrictEqual(file1Data, file1Content, 'Content of file1.txt should match');
        const file2Data = await vscode.workspace.fs.readFile(file2Uri);
        assert.deepStrictEqual(file2Data, file2Content, 'Content of file2.txt should match');
    });

    test('should throw an error if fetching fails (proxied jszip)', async () => {
        fetchStub.resolves({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        } as unknown as Response);

        const progress = { report: progressReportStub };

        await assert.rejects(
            prepareProject(projectUri, githubTemplateUrl, progress as any),
            /Failed to fetch project template. HTTP error 404 Not Found/,
            'Should throw an error when fetch is not ok'
        );
        assert.ok(fetchStub.calledOnce, 'fetch should be called');
        assert.ok(progressReportStub.calledWith({ message: 'Pochi: Fetching project template...' }), 'Progress report for fetching should still occur');
        assert.ok(jszipLoadAsyncStub.notCalled, 'Proxied jszip.loadAsync should not be called if fetch fails');

        const folderAUri = vscode.Uri.joinPath(projectUri, 'folderA');
        const file1Uri = vscode.Uri.joinPath(projectUri, 'file1.txt');
        assert.strictEqual(await isFileExists(folderAUri), false, `Directory ${folderAUri.fsPath} should NOT exist if fetch failed`);
        assert.strictEqual(await isFileExists(file1Uri), false, `File ${file1Uri.fsPath} should NOT exist if fetch failed`);
    });
});

