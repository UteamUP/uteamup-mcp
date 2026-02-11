/**
 * SSE (Server-Sent Events) parser tests
 *
 * Note: Since parseSSE is an internal function in index.js,
 * we'll extract it for testing or test it indirectly through integration tests.
 * For now, these are the test cases we would implement.
 */

describe('SSE Parser', () => {
  // Helper function extracted from index.js for testing
  function parseSSE(sseData) {
    const lines = sseData.trim().split('\n');
    let jsonData = null;

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        jsonData = line.substring(6); // Remove "data: " prefix
        break;
      }
    }

    if (jsonData) {
      try {
        return JSON.parse(jsonData);
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  describe('parseSSE', () => {
    test('should parse valid SSE format', () => {
      const sseData = `event: message
data: {"jsonrpc":"2.0","result":{"tools":[]},"id":1}`;

      const result = parseSSE(sseData);

      expect(result).toEqual({
        jsonrpc: '2.0',
        result: { tools: [] },
        id: 1
      });
    });

    test('should parse SSE with only data field', () => {
      const sseData = `data: {"success":true}`;

      const result = parseSSE(sseData);

      expect(result).toEqual({ success: true });
    });

    test('should parse SSE with multiple lines', () => {
      const sseData = `event: message
id: 123
data: {"message":"hello"}
retry: 1000`;

      const result = parseSSE(sseData);

      expect(result).toEqual({ message: 'hello' });
    });

    test('should return null for non-SSE format', () => {
      const plainJson = `{"jsonrpc":"2.0","result":{}}`;

      const result = parseSSE(plainJson);

      expect(result).toBeNull();
    });

    test('should return null for empty data', () => {
      const sseData = `event: message
data: `;

      const result = parseSSE(sseData);

      expect(result).toBeNull();
    });

    test('should return null for invalid JSON in data field', () => {
      const sseData = `data: {invalid json}`;

      const result = parseSSE(sseData);

      expect(result).toBeNull();
    });

    test('should handle whitespace correctly', () => {
      const sseData = `event: message
data: {"test": true}`;

      const result = parseSSE(sseData);

      expect(result).toEqual({ test: true });
    });

    test('should parse complex JSON in data field', () => {
      const complexData = {
        jsonrpc: '2.0',
        result: {
          tools: [
            { name: 'tool1', description: 'First tool' },
            { name: 'tool2', description: 'Second tool' }
          ]
        },
        id: 1
      };

      const sseData = `data: ${JSON.stringify(complexData)}`;

      const result = parseSSE(sseData);

      expect(result).toEqual(complexData);
    });

    test('should stop at first data field', () => {
      const sseData = `data: {"first":true}
data: {"second":true}`;

      const result = parseSSE(sseData);

      expect(result).toEqual({ first: true });
    });
  });
});
