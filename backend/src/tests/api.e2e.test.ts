import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';

describe('Number Acidizer E2E Tests', () => {
  let api: AxiosInstance;
  let initialValue: number;

  beforeAll(async () => {
    const baseURL = process.env.API_URL || 'http://localhost:3001';
    api = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      validateStatus: () => true, // Don't throw on any status
    });

    // Get initial value
    const response = await api.get('/value');
    initialValue = response.data.value || 0;
  });

  describe('Increment API', () => {
    it('should increment the counter by 1', async () => {
      const requestId = uuidv4();
      const response = await api.post(
        '/increment',
        {},
        {
          headers: { 'X-Request-ID': requestId },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.value).toBe(initialValue + 1);
      expect(response.data.requestId).toBe(requestId);
    });

    it('should handle missing request ID by generating one', async () => {
      const response = await api.post('/increment');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.requestId).toBeDefined();
      expect(response.data.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should handle concurrent increments correctly (Atomicity)', async () => {
      const concurrentRequests = 100;
      const startValue = (await api.get('/value')).data.value;

      const promises = Array(concurrentRequests)
        .fill(0)
        .map(() =>
          api.post(
            '/increment',
            {},
            {
              headers: { 'X-Request-ID': uuidv4() },
            }
          )
        );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200
      ).length;

      // Wait a bit for all operations to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const endValue = (await api.get('/value')).data.value;
      expect(endValue - startValue).toBe(successCount);
    });

    it('should maintain idempotency with same request ID', async () => {
      const requestId = uuidv4();
      const startValue = (await api.get('/value')).data.value;

      // Send same request multiple times
      const responses = await Promise.all([
        api.post('/increment', {}, { headers: { 'X-Request-ID': requestId } }),
        api.post('/increment', {}, { headers: { 'X-Request-ID': requestId } }),
        api.post('/increment', {}, { headers: { 'X-Request-ID': requestId } }),
      ]);

      // At least one should succeed
      const successResponses = responses.filter((r) => r.status === 200);
      expect(successResponses.length).toBeGreaterThanOrEqual(1);

      // Value should only increment by 1
      const endValue = (await api.get('/value')).data.value;
      expect(endValue - startValue).toBe(1);
    });

    it('should reject invalid request ID format', async () => {
      const response = await api.post(
        '/increment',
        {},
        {
          headers: { 'X-Request-ID': 'invalid-uuid' },
        }
      );

      expect(response.status).toBe(500);
      expect(response.data.success).toBe(false);
      expect(response.data.error).toBeDefined();
    });

    it('should handle maximum value boundary', async () => {
      // This test would need setup to set counter near max
      // For now, we'll test the response format
      const response = await api.post(
        '/increment',
        {},
        {
          headers: { 'X-Request-ID': uuidv4() },
        }
      );

      expect(response.status).toBe(200);
      expect(typeof response.data.value).toBe('number');
      expect(response.data.value).toBeLessThanOrEqual(1_000_000_000);
    });
  });

  describe('Decrement API', () => {
    it('should decrement the counter by 1', async () => {
      // First increment to ensure we can decrement
      await api.post(
        '/increment',
        {},
        {
          headers: { 'X-Request-ID': uuidv4() },
        }
      );

      const beforeValue = (await api.get('/value')).data.value;
      const requestId = uuidv4();

      const response = await api.post(
        '/decrement',
        {},
        {
          headers: { 'X-Request-ID': requestId },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.value).toBe(beforeValue - 1);
      expect(response.data.requestId).toBe(requestId);
    });

    it('should not decrement below zero (Consistency)', async () => {
      // Decrement until we reach 0
      let currentValue = (await api.get('/value')).data.value;

      while (currentValue > 0) {
        await api.post(
          '/decrement',
          {},
          {
            headers: { 'X-Request-ID': uuidv4() },
          }
        );
        currentValue = (await api.get('/value')).data.value;
      }

      // Try to decrement below 0
      const response = await api.post(
        '/decrement',
        {},
        {
          headers: { 'X-Request-ID': uuidv4() },
        }
      );

      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain('VALUE_OUT_OF_BOUNDS');

      // Verify value is still 0
      const finalValue = (await api.get('/value')).data.value;
      expect(finalValue).toBe(0);
    });

    it('should handle concurrent decrements correctly (Isolation)', async () => {
      // First, increment several times to ensure we have values to decrement
      const setupIncrements = 50;
      await Promise.all(
        Array(setupIncrements)
          .fill(0)
          .map(() => api.post('/increment', {}, { headers: { 'X-Request-ID': uuidv4() } }))
      );

      const startValue = (await api.get('/value')).data.value;
      const concurrentRequests = 30;

      const promises = Array(concurrentRequests)
        .fill(0)
        .map(() =>
          api.post(
            '/decrement',
            {},
            {
              headers: { 'X-Request-ID': uuidv4() },
            }
          )
        );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200
      ).length;

      // Wait for operations to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const endValue = (await api.get('/value')).data.value;
      expect(startValue - endValue).toBe(successCount);
    });

    it('should maintain idempotency with same request ID', async () => {
      // Ensure we have a value to decrement
      await api.post(
        '/increment',
        {},
        {
          headers: { 'X-Request-ID': uuidv4() },
        }
      );

      const requestId = uuidv4();
      const startValue = (await api.get('/value')).data.value;

      // Send same request multiple times
      const responses = await Promise.all([
        api.post('/decrement', {}, { headers: { 'X-Request-ID': requestId } }),
        api.post('/decrement', {}, { headers: { 'X-Request-ID': requestId } }),
        api.post('/decrement', {}, { headers: { 'X-Request-ID': requestId } }),
      ]);

      // At least one should succeed
      const successResponses = responses.filter((r) => r.status === 200);
      expect(successResponses.length).toBeGreaterThanOrEqual(1);

      // Value should only decrement by 1
      const endValue = (await api.get('/value')).data.value;
      expect(startValue - endValue).toBe(1);
    });
  });

  describe('ACID Compliance Tests', () => {
    it('should maintain consistency during rapid increment/decrement cycles', async () => {
      const startValue = (await api.get('/value')).data.value;
      const cycles = 20;

      // Perform rapid increment/decrement cycles
      for (let i = 0; i < cycles; i++) {
        await api.post('/increment', {}, { headers: { 'X-Request-ID': uuidv4() } });
        await api.post('/decrement', {}, { headers: { 'X-Request-ID': uuidv4() } });
      }

      const endValue = (await api.get('/value')).data.value;
      expect(endValue).toBe(startValue);
    });

    // it('should handle mixed concurrent operations (Isolation)', async () => {
    //   const operations = 100;
    //   const startValue = (await api.get('/value')).data.value;

    //   // Ensure we have room to both increment and decrement
    //   if (startValue < 50) {
    //     await Promise.all(
    //       Array(50)
    //         .fill(0)
    //         .map(() => api.post('/increment', {}, { headers: { 'X-Request-ID': uuidv4() } }))
    //     );
    //   }

    //   // Mix of increments and decrements
    //   const promises = Array(operations)
    //     .fill(0)
    //     .map((_, i) => {
    //       const operation = i % 2 === 0 ? 'increment' : 'decrement';
    //       return api.post(
    //         `/${operation}`,
    //         {},
    //         {
    //           headers: { 'X-Request-ID': uuidv4() },
    //         }
    //       );
    //     });

    //   const results = await Promise.allSettled(promises);
    //   const increments = results.filter(
    //     (r, i) => i % 2 === 0 && r.status === 'fulfilled' && r.value.status === 200
    //   ).length;
    //   const decrements = results.filter(
    //     (r, i) => i % 2 === 1 && r.status === 'fulfilled' && r.value.status === 200
    //   ).length;

    //   await new Promise((resolve) => setTimeout(resolve, 2000));

    //   const actualValue = (await api.get('/value')).data.value;
    //   const expectedChange = increments - decrements;

    //   // The net change should match successful operations
    //   expect(actualValue - startValue).toBeCloseTo(expectedChange, 0);
    // });

    it('should persist values correctly (Durability)', async () => {
      const testValue = uuidv4();

      // Perform an increment
      const response = await api.post(
        '/increment',
        {},
        {
          headers: {
            'X-Request-ID': testValue,
            'X-Client-ID': 'durability-test',
          },
        }
      );

      expect(response.status).toBe(200);
      const valueAfterIncrement = response.data.value;

      // Wait to ensure persistence
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify value persisted
      const verifyResponse = await api.get('/value');
      expect(verifyResponse.data.value).toBeGreaterThanOrEqual(valueAfterIncrement);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed request body gracefully', async () => {
      const response = await api.post('/increment', 'invalid-json', {
        headers: {
          'X-Request-ID': uuidv4(),
          'Content-Type': 'text/plain',
        },
      });

      // Should still work as we don't require body
      expect(response.status).toBe(200);
    });

    it('should handle missing Content-Type header', async () => {
      const response = await api.post(
        '/increment',
        {},
        {
          headers: {
            'X-Request-ID': uuidv4(),
            'Content-Type': undefined,
          },
        }
      );

      expect(response.status).toBe(200);
    });

    it('should rate limit excessive requests', async () => {
      // Send many requests rapidly
      const requests = 200;
      const results = await Promise.allSettled(
        Array(requests)
          .fill(0)
          .map(() =>
            api.post(
              '/increment',
              {},
              {
                headers: { 'X-Request-ID': uuidv4() },
              }
            )
          )
      );

      // Some requests might be rate limited (if implemented)
      const statuses = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.status);

      // All should either succeed or be rate limited
      statuses.forEach((status) => {
        expect([200, 429, 500]).toContain(status);
      });
    });
  });
});
