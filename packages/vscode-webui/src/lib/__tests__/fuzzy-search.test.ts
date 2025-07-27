import { describe, it, expect } from 'vitest';
import { fuzzySearchStrings, fuzzySearchFiles } from '../fuzzy-search';

describe('fuzzySearchStrings', () => {
  const testHaystack = [
    'converted.ts',
    'docs/prompt-examples/amp-07-08-2025/converted.ts',
    'docs/prompt-examples/claude-code-05-14-2025/converted.ts', 
    'docs/prompt-examples/claude-code-06-22-2025/converted.ts',
    'docs/prompt-examples/claude-code-07-07-2025/converted.ts',
    'some-other-file.ts',
    'another-file.js',
    'test-file.md',
    '@ampconverted.tsx',
    'user@domain.com',
    'email@test.js'
  ];

  it('should find files containing "converted" when searching for "@ampconverted"', () => {
    const results = fuzzySearchStrings('@ampconverted', testHaystack);
    
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.includes('converted'))).toBe(true);
  });

  it('should find direct matches for "@ampconverted"', () => {
    const results = fuzzySearchStrings('@ampconverted', testHaystack);
    
    expect(results).toBeDefined();
    expect(results.some(r => r.includes('@ampconverted'))).toBe(true);
  });

  it('should still work with regular "converted" searches', () => {
    const results = fuzzySearchStrings('converted', testHaystack);
    
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.includes('converted'))).toBe(true);
  });

  it('should find files with "amp" in the path', () => {
    const results = fuzzySearchStrings('amp', testHaystack);
    
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.includes('amp'))).toBe(true);
  });

  it('should find amp-07-08-2025/converted.ts when searching for "ampconverted"', () => {
    const results = fuzzySearchStrings('ampconverted', testHaystack);
    
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.includes('amp-07-08-2025/converted.ts'))).toBe(true);
  });

  it('should find amp-07-08-2025/converted.ts when searching for "amp/converted"', () => {
    const results = fuzzySearchStrings('amp/converted', testHaystack);
    
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.includes('amp-07-08-2025/converted.ts'))).toBe(true);
  });


  it('should handle @ symbols in various positions', () => {
    const testData = [
      '@ampconverted.ts',
      'user@domain.com',
      'email@test.js',
      'normal-file.ts'
    ];
    
    const results = fuzzySearchStrings('@ampconverted', testData);
    
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.includes('@ampconverted'))).toBe(true);
  });

  it('should return empty array for empty haystack', () => {
    const results = fuzzySearchStrings('test', []);
    expect(results).toEqual([]);
  });

  it('should return empty array for invalid haystack', () => {
    const results = fuzzySearchStrings('test', null as any);
    expect(results).toEqual([]);
  });

  it('should return all results when needle is empty', () => {
    const results = fuzzySearchStrings('', testHaystack);
    expect(results).toEqual(testHaystack.slice(0, 500)); // Default max results
  });

  it('should return all results when needle is undefined', () => {
    const results = fuzzySearchStrings(undefined, testHaystack);
    expect(results).toEqual(testHaystack.slice(0, 500)); // Default max results
  });

  it('should respect maxResults option', () => {
    const results = fuzzySearchStrings('', testHaystack, { maxResults: 3 });
    expect(results).toHaveLength(3);
  });

  it('should handle complex file paths with special characters', () => {
    const complexHaystack = [
      'src/components/@ui/button.tsx',
      'src/utils/email@validator.ts',
      'tests/unit/@mocks/api.js',
      'packages/core/src/lib/fuzzy-search.ts'
    ];
    
    const results = fuzzySearchStrings('@ui', complexHaystack);
    expect(results).toBeDefined();
    expect(results.some(r => r.includes('@ui'))).toBe(true);
  });

  it('should handle hyphens and underscores in file names', () => {
    const testData = [
      'file-with-hyphens.ts',
      'file_with_underscores.js',
      'normalfile.tsx',
      'test-file_mixed.ts'
    ];
    
    const results = fuzzySearchStrings('file-with', testData);
    expect(results).toBeDefined();
    expect(results.some(r => r.includes('file-with-hyphens'))).toBe(true);
  });
});

describe('fuzzySearchFiles', () => {
  const testFiles = [
    { filepath: 'converted.ts', isDir: false },
    { filepath: 'docs/prompt-examples/amp-07-08-2025/converted.ts', isDir: false },
    { filepath: '@ampconverted.tsx', isDir: false },
    { filepath: 'src/components', isDir: true },
    { filepath: 'test-file.md', isDir: false }
  ];

  const testHaystack = testFiles.map(f => f.filepath);

  it('should find files containing "converted" when searching for "@ampconverted"', () => {
    const results = fuzzySearchFiles('@ampconverted', {
      haystack: testHaystack,
      files: testFiles
    });
    
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.filepath.includes('converted'))).toBe(true);
  });

  it('should prioritize active tabs', () => {
    const activeTabs = [{ filepath: 'test-file.md', isDir: false }];
    
    const results = fuzzySearchFiles('test', {
      haystack: testHaystack,
      files: testFiles,
      activeTabs
    });
    
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].filepath).toBe('test-file.md');
  });

  it('should handle empty search with active tabs', () => {
    const activeTabs = [{ filepath: 'converted.ts', isDir: false }];
    
    const results = fuzzySearchFiles('', {
      haystack: testHaystack,
      files: testFiles,
      activeTabs
    });
    
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].filepath).toBe('converted.ts');
  });

  it('should handle files not in haystack but in active tabs', () => {
    const activeTabs = [{ filepath: 'new-active-file.ts', isDir: false }];
    
    const results = fuzzySearchFiles('new-active', {
      haystack: testHaystack,
      files: testFiles,
      activeTabs
    });
    
    expect(results).toBeDefined();
    expect(results.some(r => r.filepath === 'new-active-file.ts')).toBe(true);
  });

  it('should respect maxResults option', () => {
    const results = fuzzySearchFiles('', {
      haystack: testHaystack,
      files: testFiles
    }, { maxResults: 2 });
    
    expect(results).toBeDefined();
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should handle directories correctly', () => {
    const results = fuzzySearchFiles('components', {
      haystack: testHaystack,
      files: testFiles
    });
    
    expect(results).toBeDefined();
    expect(results.some(r => r.filepath.includes('components') && r.isDir)).toBe(true);
  });
});
