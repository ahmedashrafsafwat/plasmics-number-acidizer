import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface TestResult {
  passed: boolean;
  message: string;
  duration: number;
}

class ACIDTester {
  private apiUrl: string;

  constructor(apiUrl: string = API_URL) {
    this.apiUrl = apiUrl;
  }

  async testAtomicity(): Promise<TestResult> {
    const start = Date.now();

    try {
      // Get initial value
      const initial = await this.getValue();

      // Perform multiple operations
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 100; i++) {
        promises.push(this.increment());
      }

      await Promise.all(promises);

      // Verify final value
      const final = await this.getValue();
      const expected = initial + 100;

      if (final === expected) {
        return {
          passed: true,
          message: `Atomicity test passed: ${initial} + 100 = ${final}`,
          duration: Date.now() - start,
        };
      } else {
        return {
          passed: false,
          message: `Atomicity test failed: expected ${expected}, got ${final}`,
          duration: Date.now() - start,
        };
      }
    } catch (error) {
      console.log(error);
      return {
        passed: false,
        message: `Atomicity test error: ${error}`,
        duration: Date.now() - start,
      };
    }
  }

  async testConsistency(): Promise<TestResult> {
    const start = Date.now();

    try {
      // Test boundary conditions
      const testCases = [
        { operation: 'decrement', expectedError: true }, // Should fail at 0
        { operation: 'increment', expectedError: false },
      ];

      // Reset to 0
      const current = await this.getValue();
      for (let i = 0; i < current; i++) {
        await this.decrement();
      }

      for (const testCase of testCases) {
        try {
          if (testCase.operation === 'increment') {
            await this.increment();
          } else {
            await this.decrement();
          }

          if (testCase.expectedError) {
            return {
              passed: false,
              message: 'Consistency test failed: expected error but succeeded',
              duration: Date.now() - start,
            };
          }
        } catch (error) {
          if (!testCase.expectedError) {
            return {
              passed: false,
              message: `Consistency test failed: unexpected error ${error}`,
              duration: Date.now() - start,
            };
          }
        }
      }

      return {
        passed: true,
        message: 'Consistency test passed: boundaries enforced correctly',
        duration: Date.now() - start,
      };
    } catch (error) {
      return {
        passed: false,
        message: `Consistency test error: ${error}`,
        duration: Date.now() - start,
      };
    }
  }

  async testIsolation(): Promise<TestResult> {
    const start = Date.now();

    try {
      const initial = await this.getValue();
      const concurrentOps = 50;

      // Perform concurrent increments and decrements
      const operations: Promise<void>[] = [];
      for (let i = 0; i < concurrentOps; i++) {
        operations.push(this.increment());
        operations.push(this.decrement());
      }

      await Promise.all(operations);

      const final = await this.getValue();

      if (final === initial) {
        return {
          passed: true,
          message: `Isolation test passed: ${concurrentOps} inc/dec pairs = net zero change`,
          duration: Date.now() - start,
        };
      } else {
        return {
          passed: false,
          message: `Isolation test failed: expected ${initial}, got ${final}`,
          duration: Date.now() - start,
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: `Isolation test error: ${error}`,
        duration: Date.now() - start,
      };
    }
  }

  async testDurability(): Promise<TestResult> {
    const start = Date.now();

    try {
      // Perform operation
      const before = await this.getValue();
      await this.increment();
      const after = await this.getValue();

      // Wait and verify value persists
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const verified = await this.getValue();

      if (after === verified && after === before + 1) {
        return {
          passed: true,
          message: 'Durability test passed: value persisted correctly',
          duration: Date.now() - start,
        };
      } else {
        return {
          passed: false,
          message: `Durability test failed: value changed from ${after} to ${verified}`,
          duration: Date.now() - start,
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: `Durability test error: ${error}`,
        duration: Date.now() - start,
      };
    }
  }

  async stressTest(duration: number = 10000): Promise<TestResult> {
    const start = Date.now();
    const results = {
      operations: 0,
      errors: 0,
      successRate: 0,
    };

    const endTime = Date.now() + duration;

    while (Date.now() < endTime) {
      const promises: Promise<void>[] = [];

      // Batch operations
      for (let i = 0; i < 10; i++) {
        promises.push(
          (Math.random() > 0.5 ? this.increment() : this.decrement())
            .then(() => {
              results.operations++;
            })
            .catch(() => {
              results.errors++;
            })
        );
      }

      await Promise.all(promises);
    }

    results.successRate = (results.operations / (results.operations + results.errors)) * 100;

    return {
      passed: results.successRate > 95,
      message: `Stress test: ${results.operations} ops, ${
        results.errors
      } errors, ${results.successRate.toFixed(2)}% success rate`,
      duration: Date.now() - start,
    };
  }

  private async getValue(): Promise<number> {
    const response = await axios.get(`${this.apiUrl}/value`);
    return response.data.value;
  }

  private async increment(): Promise<void> {
    await axios.post(
      `${this.apiUrl}/increment`,
      {},
      {
        headers: { 'X-Request-ID': uuidv4() },
      }
    );
  }

  private async decrement(): Promise<void> {
    await axios.post(
      `${this.apiUrl}/decrement`,
      {},
      {
        headers: { 'X-Request-ID': uuidv4() },
      }
    );
  }
}

// Run tests
async function runAllTests() {
  console.log('🧪 Running ACID compliance tests...\n');

  const tester = new ACIDTester();
  const tests = [
    { name: 'Atomicity', test: () => tester.testAtomicity() },
    { name: 'Consistency', test: () => tester.testConsistency() },
    { name: 'Isolation', test: () => tester.testIsolation() },
    { name: 'Durability', test: () => tester.testDurability() },
    { name: 'Stress Test', test: () => tester.stressTest(5000) },
  ];

  let allPassed = true;

  for (const { name, test } of tests) {
    console.log(`Running ${name} test...`);
    const result = await test();

    if (result.passed) {
      console.log(`✅ ${result.message} (${result.duration}ms)`);
    } else {
      console.log(`❌ ${result.message} (${result.duration}ms)`);
      allPassed = false;
    }
    console.log();
  }

  if (allPassed) {
    console.log('🎉 All ACID tests passed!');
    process.exit(0);
  } else {
    console.log('💥 Some tests failed!');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runAllTests();
}

export { ACIDTester };
