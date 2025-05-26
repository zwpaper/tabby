import * as assert from "assert";
import { describe, it } from "mocha";
import { streamWithAbort, streamWithTimeout } from "../stream-utils";

// Helper function to create an async iterable stream
function createAsyncIterable(values: string[], delays?: number[]): AsyncIterable<string> {
  let index = 0;
  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<string>> {
          if (index >= values.length) {
            return { value: undefined, done: true };
          }
          
          const value = values[index];
          const delay = delays?.[index] || 0;
          index++;
          
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          return { value, done: false };
        },
        async return(): Promise<IteratorResult<string>> {
          // Mock return method for proper cleanup
          return { value: undefined, done: true };
        }
      };
    }
  };
}

// Helper function to create an async iterable that throws an error
function createErrorAsyncIterable(errorMessage: string, afterValues?: string[]): AsyncIterable<string> {
  let index = 0;
  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<string>> {
          if (afterValues && index < afterValues.length) {
            const value = afterValues[index];
            index++;
            return { value, done: false };
          }
          throw new Error(errorMessage);
        },
        async return(): Promise<IteratorResult<string>> {
          return { value: undefined, done: true };
        }
      };
    }
  };
}

describe("Stream Utils", () => {
  describe("streamWithAbort", () => {
    it("should collect all values from a simple stream", async () => {
      const stream = createAsyncIterable(["hello", " ", "world"]);
      
      const result = await streamWithAbort(stream);
      
      assert.strictEqual(result, "hello world");
    });

    it("should handle empty stream", async () => {
      const stream = createAsyncIterable([]);
      
      const result = await streamWithAbort(stream);
      
      assert.strictEqual(result, "");
    });

    it("should handle single value stream", async () => {
      const stream = createAsyncIterable(["single"]);
      
      const result = await streamWithAbort(stream);
      
      assert.strictEqual(result, "single");
    });

    it("should abort stream when abort signal is triggered", async () => {
      const abortController = new AbortController();
      const stream = createAsyncIterable(["hello", " ", "world"], [10, 10, 100]);
      
      const resultPromise = streamWithAbort(stream, abortController.signal);
      
      // Let some values be processed, then abort
      setTimeout(() => {
        abortController.abort();
      }, 30);
      
      const result = await resultPromise;
      // Should have processed first two values before abort
      assert.strictEqual(result, "hello ");
    });

    it("should return empty string when abort signal is already aborted", async () => {
      const abortController = new AbortController();
      abortController.abort(); // Abort before starting
      
      const stream = createAsyncIterable(["hello", "world"]);
      
      const result = await streamWithAbort(stream, abortController.signal);
      
      assert.strictEqual(result, "");
    });

    it("should handle timeout without resetTimeoutOnData", async () => {
      const stream = createAsyncIterable(["hello", " ", "world"], [10, 10, 200]);
      
      const result = await streamWithAbort(stream, undefined, { 
        timeout: 50,
        resetTimeoutOnData: false 
      });
      
      // Should timeout after 50ms from start, getting first two values
      assert.strictEqual(result, "hello ");
    });

    it("should handle timeout with resetTimeoutOnData", async () => {
      const stream = createAsyncIterable(["hello", " ", "world"], [10, 10, 200]);
      
      const result = await streamWithAbort(stream, undefined, { 
        timeout: 50,
        resetTimeoutOnData: true 
      });
      
      // Should timeout 50ms after the second value, not getting the third
      assert.strictEqual(result, "hello ");
    });

    it("should complete normally when no timeout is reached", async () => {
      const stream = createAsyncIterable(["hello", " ", "world"], [10, 10, 10]);
      
      const result = await streamWithAbort(stream, undefined, { 
        timeout: 100,
        resetTimeoutOnData: true 
      });
      
      assert.strictEqual(result, "hello world");
    });

    it("should handle stream errors", async () => {
      const stream = createErrorAsyncIterable("Test error", ["hello"]);
      
      try {
        await streamWithAbort(stream);
        assert.fail("Expected error to be thrown");
      } catch (error) {
        assert.strictEqual((error as Error).message, "Test error");
      }
    });

    it("should handle stream errors with abort signal", async () => {
      const abortController = new AbortController();
      const stream = createErrorAsyncIterable("Test error", ["hello"]);
      
      try {
        await streamWithAbort(stream, abortController.signal);
        assert.fail("Expected error to be thrown");
      } catch (error) {
        assert.strictEqual((error as Error).message, "Test error");
      }
    });

    it("should handle stream with proper cleanup", async () => {
      const abortController = new AbortController();
      
      const stream: AsyncIterable<string> = {
        [Symbol.asyncIterator]() {
          return {
            async next(): Promise<IteratorResult<string>> {
              // Return a value then indicate done
              return { value: "test", done: false };
            },
            async return(): Promise<IteratorResult<string>> {
              return { value: undefined, done: true };
            }
          };
        }
      };
      
      const resultPromise = streamWithAbort(stream, abortController.signal);
      
      // Abort immediately to trigger cleanup
      abortController.abort();
      
      const result = await resultPromise;
      
      // Should return empty string when aborted before any processing
      assert.strictEqual(result, "");
    });

    it("should handle iterator return method throwing error", async () => {
      const abortController = new AbortController();
      
      const stream: AsyncIterable<string> = {
        [Symbol.asyncIterator]() {
          let index = 0;
          const values = ["hello", " ", "world"];
          return {
            async next(): Promise<IteratorResult<string>> {
              if (index >= values.length) {
                return { value: undefined, done: true };
              }
              const value = values[index];
              index++;
              await new Promise(resolve => setTimeout(resolve, 10));
              return { value, done: false };
            },
            async return(): Promise<IteratorResult<string>> {
              throw new Error("Return method error");
            }
          };
        }
      };
      
      const resultPromise = streamWithAbort(stream, abortController.signal);
      
      setTimeout(() => {
        abortController.abort();
      }, 15);
      
      // Should not throw error, should handle gracefully
      const result = await resultPromise;
      assert.strictEqual(result, "hello");
    });

    it("should handle iterator without return method", async () => {
      const abortController = new AbortController();
      
      const stream: AsyncIterable<string> = {
        [Symbol.asyncIterator]() {
          let index = 0;
          const values = ["hello", " ", "world"];
          return {
            async next(): Promise<IteratorResult<string>> {
              if (index >= values.length) {
                return { value: undefined, done: true };
              }
              const value = values[index];
              index++;
              await new Promise(resolve => setTimeout(resolve, 10));
              return { value, done: false };
            }
            // No return method
          };
        }
      };
      
      const resultPromise = streamWithAbort(stream, abortController.signal);
      
      setTimeout(() => {
        abortController.abort();
      }, 15);
      
      const result = await resultPromise;
      assert.strictEqual(result, "hello");
    });

    it("should handle multiple abort listeners", async () => {
      const abortController = new AbortController();
      const stream1 = createAsyncIterable(["hello"], [50]);
      const stream2 = createAsyncIterable(["world"], [50]);
      
      const promise1 = streamWithAbort(stream1, abortController.signal);
      const promise2 = streamWithAbort(stream2, abortController.signal);
      
      setTimeout(() => {
        abortController.abort();
      }, 10);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      assert.strictEqual(result1, "");
      assert.strictEqual(result2, "");
    });

    it("should cleanup timeout when stream completes normally", async () => {
      const stream = createAsyncIterable(["hello", "world"], [10, 10]);
      
      const result = await streamWithAbort(stream, undefined, { timeout: 100 });
      
      assert.strictEqual(result, "helloworld");
    });

    it("should cleanup abort listener when stream completes normally", async () => {
      const abortController = new AbortController();
      const stream = createAsyncIterable(["hello", "world"], [10, 10]);
      
      const result = await streamWithAbort(stream, abortController.signal);
      
      assert.strictEqual(result, "helloworld");
      
      // Abort after completion should not affect anything
      abortController.abort();
      
      // Stream should still have completed normally
      assert.strictEqual(result, "helloworld");
    });
  });

  describe("streamWithTimeout", () => {
    it("should use default timeout of 5000ms", async () => {
      const stream = createAsyncIterable(["hello", "world"], [10, 10]);
      
      const result = await streamWithTimeout(stream);
      
      assert.strictEqual(result, "helloworld");
    });

    it("should use custom timeout", async () => {
      const stream = createAsyncIterable(["hello", "world"], [10, 100]);
      
      const result = await streamWithTimeout(stream, undefined, 50);
      
      // Should timeout after 50ms from last data (after "hello")
      assert.strictEqual(result, "hello");
    });

    it("should reset timeout on new data", async () => {
      const stream = createAsyncIterable(["hello", " ", "world"], [20, 20, 10]);
      
      const result = await streamWithTimeout(stream, undefined, 50);
      
      // Each new data resets the 50ms timeout, so all values should be collected
      assert.strictEqual(result, "hello world");
    });

    it("should work with abort signal", async () => {
      const abortController = new AbortController();
      const stream = createAsyncIterable(["hello", "world"], [10, 10]);
      
      const resultPromise = streamWithTimeout(stream, abortController.signal, 100);
      
      setTimeout(() => {
        abortController.abort();
      }, 15);
      
      const result = await resultPromise;
      assert.strictEqual(result, "hello");
    });

    it("should handle empty stream with timeout", async () => {
      const stream = createAsyncIterable([]);
      
      const result = await streamWithTimeout(stream, undefined, 100);
      
      assert.strictEqual(result, "");
    });

    it("should handle stream errors with timeout", async () => {
      const stream = createErrorAsyncIterable("Timeout test error", ["hello"]);
      
      try {
        await streamWithTimeout(stream, undefined, 100);
        assert.fail("Expected error to be thrown");
      } catch (error) {
        assert.strictEqual((error as Error).message, "Timeout test error");
      }
    });
  });

  describe("edge cases and integration", () => {
    it("should handle very fast streams without timeout", async () => {
      const values = Array.from({ length: 50 }, (_, i) => `chunk${i}`);
      const stream = createAsyncIterable(values, values.map(() => 1));
      
      const result = await streamWithAbort(stream, undefined, { timeout: 100 });
      
      assert.strictEqual(result, values.join(""));
    });

    it("should handle concurrent streams with different timeouts", async () => {
      const stream1 = createAsyncIterable(["fast1", "fast2"], [5, 5]);
      const stream2 = createAsyncIterable(["slow1", "slow2"], [10, 50]);
      
      const promise1 = streamWithAbort(stream1, undefined, { timeout: 50 });
      const promise2 = streamWithAbort(stream2, undefined, { timeout: 30 });
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      assert.strictEqual(result1, "fast1fast2");
      assert.strictEqual(result2, "slow1"); // Should timeout after first value
    });

    it("should handle abort and timeout race condition", async () => {
      const abortController = new AbortController();
      const stream = createAsyncIterable(["hello", "world"], [10, 10]);
      
      const resultPromise = streamWithAbort(stream, abortController.signal, { timeout: 15 });
      
      // Both abort and timeout would happen around the same time
      setTimeout(() => {
        abortController.abort();
      }, 14);
      
      const result = await resultPromise;
      assert.strictEqual(result, "hello");
    });

    it("should handle large amounts of data", async () => {
      const largeData = Array.from({ length: 1000 }, () => "x").join("");
      const stream = createAsyncIterable([largeData]);
      
      const result = await streamWithAbort(stream);
      
      assert.strictEqual(result, largeData);
    });

    it("should handle unicode and special characters", async () => {
      const specialChars = ["🚀", "Hello 世界", "测试", "🎉"];
      const stream = createAsyncIterable(specialChars);
      
      const result = await streamWithAbort(stream);
      
      assert.strictEqual(result, specialChars.join(""));
    });
  });
});










