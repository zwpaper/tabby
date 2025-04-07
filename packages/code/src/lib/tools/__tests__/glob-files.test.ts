import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { globFiles } from '../glob-files'; // Adjust the import path as necessary

// Define MAX_FILES based on the source file (or import it if possible)
const MAX_FILES = 300;

describe('globFiles', () => {
  let testDir: string;

  beforeAll(async () => {
    // Create a temporary directory for test files
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'glob-files-test-'));

    // Create test files and directories
    await fs.mkdir(path.join(testDir, 'subdir'));
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
    await fs.writeFile(path.join(testDir, 'file2.js'), 'content2');
    await fs.writeFile(path.join(testDir, 'subdir', 'file3.txt'), 'content3');
    await fs.writeFile(path.join(testDir, 'subdir', 'file4.ts'), 'content4');
    await fs.mkdir(path.join(testDir, 'empty_dir')); // Ensure directories are not matched
  });

  afterAll(async () => {
    // Clean up the temporary directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should find files matching a simple pattern', async () => {
    const result = await globFiles({ path: testDir, globPattern: '*.txt' });
    expect(result.files).toEqual(['file1.txt']);
    expect(result.isTruncated).toBe(false);
  });

  it('should find files matching a pattern with extension', async () => {
    const result = await globFiles({ path: testDir, globPattern: '*.js' });
    expect(result.files).toEqual(['file2.js']);
    expect(result.isTruncated).toBe(false);
  });

  it('should find files recursively using **', async () => {
    const result = await globFiles({ path: testDir, globPattern: '**/*.txt' });
    // Sort results for consistent comparison
    result.files.sort();
    expect(result.files).toEqual(['file1.txt', path.join('subdir', 'file3.txt')]);
    expect(result.isTruncated).toBe(false);
  });

  it('should find all files using **/*', async () => {
    const result = await globFiles({ path: testDir, globPattern: '**/*' });
     // Sort results for consistent comparison
    result.files.sort();
    expect(result.files).toEqual([
      'file1.txt',
      'file2.js',
      path.join('subdir', 'file3.txt'),
      path.join('subdir', 'file4.ts'),
    ]);
    expect(result.isTruncated).toBe(false);
  });


  it('should return an empty array if no files match', async () => {
    const result = await globFiles({ path: testDir, globPattern: '*.nonexistent' });
    expect(result.files).toEqual([]);
    expect(result.isTruncated).toBe(false);
  });

  it('should not return directories', async () => {
    const result = await globFiles({ path: testDir, globPattern: 'subdir' });
    expect(result.files).toEqual([]); // 'subdir' itself shouldn't be listed
    const result2 = await globFiles({ path: testDir, globPattern: 'empty_dir' });
    expect(result2.files).toEqual([]); // 'empty_dir' itself shouldn't be listed
    const result3 = await globFiles({ path: testDir, globPattern: '**/*' });
     // Ensure directories are not included even with recursive glob
    expect(result3.files).not.toContain('subdir');
    expect(result3.files).not.toContain('empty_dir');
    expect(result3.files).not.toContain(path.join('subdir', '')); // Check trailing slash case if glob behaves differently
  });

  it('should handle paths with spaces', async () => {
    const dirWithSpace = path.join(testDir, 'dir with space');
    const fileWithSpace = path.join(dirWithSpace, 'file with space.txt');
    await fs.mkdir(dirWithSpace);
    await fs.writeFile(fileWithSpace, 'space content');

    const result = await globFiles({ path: testDir, globPattern: '**/*.txt' });
    result.files.sort();
    expect(result.files).toContain(path.join('dir with space', 'file with space.txt'));

    const result2 = await globFiles({ path: dirWithSpace, globPattern: '*.txt' });
    expect(result2.files).toEqual(['file with space.txt']);
  });

  it('should truncate results if they exceed MAX_FILES', async () => {
    const largeDir = path.join(testDir, 'large_dir');
    await fs.mkdir(largeDir);
    const promises = [];
    // Create MAX_FILES + 5 files
    for (let i = 0; i < MAX_FILES + 5; i++) {
      promises.push(fs.writeFile(path.join(largeDir, `large_file_${i}.test`), `content_${i}`));
    }
    await Promise.all(promises);

    const result = await globFiles({ path: largeDir, globPattern: '*.test' });
    expect(result.files.length).toBe(MAX_FILES);
    expect(result.isTruncated).toBe(true);

    // Clean up the large directory contents specifically for this test
    await fs.rm(largeDir, { recursive: true, force: true });
  });

   it('should return relative paths from the searchPath', async () => {
    const result = await globFiles({ path: testDir, globPattern: 'subdir/*.ts' });
    expect(result.files).toEqual([path.join('subdir', 'file4.ts')]); // Path should be relative to testDir
    expect(result.isTruncated).toBe(false);
  });

  // Add more tests for edge cases if necessary (e.g., invalid patterns, permissions - though glob might handle these)
});
