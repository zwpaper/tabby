import { describe, it, expect } from 'vitest';
import { filterPlayrightMarkdown } from '../filter-playwright';

describe('filterPlayrightMarkdown', () => {
  describe('string input handling', () => {
    it('should remove markdown code blocks with language specifier', () => {
      const input = 'Some text\n```typescript\nconst x = 1;\n```\nMore text';
      const result = filterPlayrightMarkdown(input);
      expect(result).toBe('Some text\n\nMore text');
    });

    it('should remove markdown code blocks without language specifier', () => {
      const input = 'Some text\n```\nconst x = 1;\n```\nMore text';
      const result = filterPlayrightMarkdown(input);
      expect(result).toBe('Some text\n\nMore text');
    });

    it('should remove multiple markdown code blocks', () => {
      const input = 'Text\n```js\ncode1\n```\nMiddle\n```python\ncode2\n```\nEnd';
      const result = filterPlayrightMarkdown(input);
      expect(result).toBe('Text\n\nMiddle\n\nEnd');
    });

    it('should collapse multiple consecutive newlines and trim', () => {
      const input = '  \nText\n\n\n\nMore text\n  ';
      const result = filterPlayrightMarkdown(input);
      expect(result).toBe('Text\n\nMore text');
    });

    it('should handle strings without markdown blocks', () => {
      const input = 'This is just plain text';
      const result = filterPlayrightMarkdown(input);
      expect(result).toBe('This is just plain text');
    });

    it('should handle empty strings', () => {
      const input = '';
      const result = filterPlayrightMarkdown(input);
      expect(result).toBe('');
    });
  });

  describe('non-string input handling', () => {
    it('should return non-string values unchanged', () => {
      expect(filterPlayrightMarkdown(42)).toBe(42);
      expect(filterPlayrightMarkdown(true)).toBe(true);
      expect(filterPlayrightMarkdown(null)).toBe(null);
      expect(filterPlayrightMarkdown(undefined)).toBe(undefined);
      
      const obj = { key: 'value' };
      expect(filterPlayrightMarkdown(obj)).toBe(obj);
      
      const arr = [1, 2, 3];
      expect(filterPlayrightMarkdown(arr)).toBe(arr);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical playwright test output', () => {
      const input = `
Test execution completed successfully.

\`\`\`javascript
await page.click('button[data-testid="submit"]');
await expect(page).toHaveURL('/success');
\`\`\`

The test verified that clicking the submit button navigates to the success page.

All assertions passed.
      `.trim();
      
      const result = filterPlayrightMarkdown(input);
      expect(result).toBe('Test execution completed successfully.\n\nThe test verified that clicking the submit button navigates to the success page.\n\nAll assertions passed.');
    });
  });
});
