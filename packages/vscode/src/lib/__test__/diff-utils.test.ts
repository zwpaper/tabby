import * as assert from 'assert';
import { createPrettyPatch } from '../diff-utils';

suite('diff-utils', () => {
  suite('createPrettyPatch', () => {
    test('should create a pretty patch with default filename', () => {
      const oldStr = 'line1\nline2\nline3';
      const newStr = 'line1\nmodified line2\nline3';
      
      const result = createPrettyPatch(undefined, oldStr, newStr);
      
      assert.ok(result.includes('-line2'), 'Should include removed line');
      assert.ok(result.includes('+modified line2'), 'Should include added line');
      assert.ok(result.includes('@@ -1,3 +1,3 @@'), 'Should include hunk header');
    });

    test('should create a pretty patch with custom filename', () => {
      const oldStr = 'line1\nline2\nline3';
      const newStr = 'line1\nmodified line2\nline3';
      const filename = 'test.txt';
      
      const result = createPrettyPatch(filename, oldStr, newStr);
      
      assert.ok(result.includes('-line2'), 'Should include removed line');
      assert.ok(result.includes('+modified line2'), 'Should include added line');
      assert.ok(result.includes('@@ -1,3 +1,3 @@'), 'Should include hunk header');
    });

    test('should handle empty oldStr', () => {
      const newStr = 'line1\nline2';
      
      const result = createPrettyPatch('file', '', newStr);
      
      assert.ok(result.includes('+line1'), 'Should include added line1');
      assert.ok(result.includes('+line2'), 'Should include added line2');
    });

    test('should handle empty newStr', () => {
      const oldStr = 'line1\nline2';
      
      const result = createPrettyPatch('file', oldStr, '');
      
      assert.ok(result.includes('-line1'), 'Should include removed line1');
      assert.ok(result.includes('-line2'), 'Should include removed line2');
    });

    test('should handle both strings empty or undefined', () => {
      let result = createPrettyPatch('file', '', '');
      assert.strictEqual(result, '', 'With empty strings, no diff content should remain after header removal');
      
      result = createPrettyPatch('file', undefined, undefined);
      assert.strictEqual(result, '', 'With undefined strings, no diff content should remain after header removal');
    });

    test('should handle multiline strings', () => {
      const oldStr = 'line1\nline2\nline3\nline4';
      const newStr = 'line1\nline2 modified\nline3\nline4\nline5';
      
      const result = createPrettyPatch('file', oldStr, newStr);
      
      assert.ok(result.includes('-line2'), 'Should include removed line');
      assert.ok(result.includes('+line2 modified'), 'Should include modified line');
      assert.ok(result.includes('+line5'), 'Should include added line');
    });

    test('should skip the first 4 lines of the diff output', () => {
      const oldStr = 'line1';
      const newStr = 'modified line1';
      
      const result = createPrettyPatch('file', oldStr, newStr);
      
      assert.ok(!result.includes('diff --git'), 'Should not include diff --git line');
      assert.ok(!result.includes('index'), 'Should not include index line');
      assert.ok(!result.includes('---'), 'Should not include --- line');
      assert.ok(!result.includes('+++'), 'Should not include +++ line');
    });
  });
});