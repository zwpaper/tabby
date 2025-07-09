import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { afterEach, beforeEach, suite, test } from 'mocha';
import * as jszip from 'jszip';
import proxyquire from 'proxyquire';
import { isFileExists } from '../../fs';
import { Buffer } from 'buffer';
import * as os from 'node:os';

const utilsModulePath = '../utils';

suite('prepareProject Suite', () => {
    let execPromiseStub: sinon.SinonStub;
    let fetchStub: sinon.SinonStub;
    let jszipLoadAsyncStub: sinon.SinonStub;
    let progressReportStub: sinon.SinonStub;
    let prepareProject: any;

    const testRunId = `test-prepare-${Date.now()}`;
    const baseTestDir = vscode.Uri.file(`/tmp/pochi-vscode-tests/${testRunId}`);
    const projectUri = vscode.Uri.joinPath(baseTestDir, 'my-test-project');
    const githubTemplateUrl = 'https://github.com/test-owner/test-repo';

    beforeEach(async () => {
        await vscode.workspace.fs.createDirectory(baseTestDir);
        await vscode.workspace.fs.createDirectory(projectUri);

        execPromiseStub = sinon.stub();
        fetchStub = sinon.stub(global, 'fetch');
        progressReportStub = sinon.stub();
        jszipLoadAsyncStub = sinon.stub();

        const utils = proxyquire(utilsModulePath, {
            'node:util': {
                promisify: () => execPromiseStub
            },
            'jszip': {
                loadAsync: jszipLoadAsyncStub,
            },
        });
        prepareProject = utils.prepareProject;
    });

    afterEach(async () => {
        sinon.restore();
        proxyquire.callThru();
        try {
            if (await isFileExists(baseTestDir)) {
                await vscode.workspace.fs.delete(baseTestDir, { recursive: true, useTrash: false });
            }
        } catch (error) {
            console.warn(`Error cleaning up test directory ${baseTestDir.fsPath}:`, error);
        }
    });

    test('should use system commands to fetch and extract if available', async () => {
        execPromiseStub.resolves({ stdout: '', stderr: '' }); // Simulate all commands succeed

        const progress = { report: progressReportStub };
        await prepareProject(projectUri, githubTemplateUrl, progress as any);

        assert.ok(execPromiseStub.calledWith('curl --version'), 'Should check for curl version');
        assert.ok(execPromiseStub.calledWith('unzip -v'), 'Should check for unzip version');
        
        const expectedZipUrl = 'https://github.com/test-owner/test-repo/archive/refs/heads/main.zip';
        const urlBase64 = Buffer.from(expectedZipUrl).toString('base64url').replace(/[^a-zA-Z0-9]/g, '');
        const tempZipPath = vscode.Uri.joinPath(vscode.Uri.file(os.tmpdir()), 'pochi', 'downloads', `${urlBase64}.zip`).fsPath;

        assert.ok(execPromiseStub.calledWith(`curl -L \"${expectedZipUrl}\" -o \"${tempZipPath}\"`), 'Should call curl to download');
        assert.ok(execPromiseStub.calledWith(`unzip -q \"${tempZipPath}\" -d \"${projectUri.fsPath}\"`), 'Should call unzip to extract');

        assert.ok(progressReportStub.calledWith({ message: 'Pochi: Fetching project template...' }), 'Progress report for fetching');
        assert.ok(progressReportStub.calledWith({ message: 'Pochi: Extracting project template...' }), 'Progress report for extracting');
        
        assert.ok(fetchStub.notCalled, 'Fetch should not be called when system commands are used');
        assert.ok(jszipLoadAsyncStub.notCalled, 'JSZip should not be called when system commands are used');
    });

    test('should fall back to JSZip if system commands are not available', async () => {
        execPromiseStub.rejects(new Error('command not found')); // Simulate system commands failing

        const mockZipBuffer = new ArrayBuffer(8);
        const file1Content = Buffer.from([1, 2, 3]);
        const mockZip = {
            files: {
                'test-repo-main/': { dir: true, async: sinon.stub().resolves(null) },
                'test-repo-main/file1.txt': { dir: false, async: sinon.stub().resolves(new Uint8Array([1, 2, 3])) },
            }
        };

        fetchStub.resolves({ ok: true, arrayBuffer: sinon.stub().resolves(mockZipBuffer) } as unknown as Response);
        jszipLoadAsyncStub.resolves(mockZip as unknown as jszip);

        const progress = { report: progressReportStub };
        await prepareProject(projectUri, githubTemplateUrl, progress as any);

        assert.ok(execPromiseStub.calledWith('curl --version'), 'Should attempt to check for curl');
        assert.ok(fetchStub.calledOnce, 'Fetch should be called as a fallback');
        assert.ok(jszipLoadAsyncStub.calledOnceWith(mockZipBuffer), 'JSZip loadAsync should be called as a fallback');

        const file1Uri = vscode.Uri.joinPath(projectUri, 'file1.txt');
        assert.ok(await isFileExists(file1Uri), 'File should be created by JSZip fallback');
        const file1Data = await vscode.workspace.fs.readFile(file1Uri);
        assert.deepStrictEqual(file1Data, file1Content, 'File content should match');
    });

    test('should throw an error if fetching fails in JSZip fallback', async () => {
        execPromiseStub.rejects(new Error('command not found')); // Force fallback

        fetchStub.resolves({ ok: false, status: 404, statusText: 'Not Found' } as unknown as Response);

        const progress = { report: progressReportStub };

        await assert.rejects(
            prepareProject(projectUri, githubTemplateUrl, progress as any),
            /Failed to fetch project template. HTTP error 404 Not Found/,
            'Should throw an error when fetch fails in fallback'
        );

        assert.ok(fetchStub.calledOnce, 'fetch should be called');
        assert.ok(jszipLoadAsyncStub.notCalled, 'JSZip should not be called if fetch fails');
    });
});
