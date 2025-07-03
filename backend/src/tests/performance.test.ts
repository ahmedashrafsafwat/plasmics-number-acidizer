import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';

interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  throughput: number; // requests per second
}

describe('Performance Tests', () => {
  let api: AxiosInstance;
  
  beforeAll(() => {
    const baseURL = process.env.API_URL || 'http://localhost:3001';
    api = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    });
  });

  const measurePerformance = async (
    operation: 'increment' | 'decrement',
    concurrentUsers: number,
    requestsPerUser: number
  ): Promise<PerformanceMetrics> => {
    const responseTimes: number[] = [];
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    const userSimulation = async () => {
      for (let i = 0; i < requestsPerUser; i++) {
        const requestStart = Date.now();
        try {
          const response = await api.post(`/${operation}`, {}, {
            headers: { 'X-Request-ID': uuidv4() }
          });
          
          const responseTime = Date.now() - requestStart;
          responseTimes.push(responseTime);
          
          if (response.status === 200) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
          responseTimes.push(Date.now() - requestStart);
        }
      }
    };

    // Simulate concurrent users
    await Promise.all(
      Array(concurrentUsers).fill(0).map(() => userSimulation())
    );

    const totalTime = (Date.now() - startTime) / 1000; // in seconds
    const totalRequests = concurrentUsers * requestsPerUser;
    
    // Calculate percentiles
    responseTimes.sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * responseTimes.length) - 1;
      return responseTimes[index] || 0;
    };

    return {
      totalRequests,
      successfulRequests: successCount,
      failedRequests: failCount,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      percentiles: {
        p50: getPercentile(50),
        p90: getPercentile(90),
        p95: getPercentile(95),
        p99: getPercentile(99),
      },
      throughput: totalRequests / totalTime,
    };
  };

  describe('Load Testing', () => {
    it('should handle light load (10 concurrent users)', async () => {
      const metrics = await measurePerformance('increment', 10, 10);
      
      expect(metrics.successfulRequests).toBeGreaterThan(metrics.totalRequests * 0.95); // 95% success rate
      expect(metrics.averageResponseTime).toBeLessThan(200); // Under 200ms average
      expect(metrics.percentiles.p95).toBeLessThan(500); // 95th percentile under 500ms
    });

    it('should handle moderate load (50 concurrent users)', async () => {
      const metrics = await measurePerformance('increment', 50, 20);
      
      expect(metrics.successfulRequests).toBeGreaterThan(metrics.totalRequests * 0.90); // 90% success rate
      expect(metrics.averageResponseTime).toBeLessThan(500); // Under 500ms average
      expect(metrics.percentiles.p95).toBeLessThan(1000); // 95th percentile under 1s
      
      console.log('Moderate Load Test Results:', {
        throughput: `${metrics.throughput.toFixed(2)} req/s`,
        avgResponseTime: `${metrics.averageResponseTime.toFixed(2)}ms`,
        p95: `${metrics.percentiles.p95}ms`,
        successRate: `${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`
      });
    });

    it('should handle heavy load (100 concurrent users)', async () => {
      const metrics = await measurePerformance('increment', 100, 10);
      
      expect(metrics.successfulRequests).toBeGreaterThan(metrics.totalRequests * 0.80); // 80% success rate
      expect(metrics.percentiles.p50).toBeLessThan(1000); // Median under 1s
      
      console.log('Heavy Load Test Results:', {
        throughput: `${metrics.throughput.toFixed(2)} req/s`,
        avgResponseTime: `${metrics.averageResponseTime.toFixed(2)}ms`,
        p50: `${metrics.percentiles.p50}ms`,
        p95: `${metrics.percentiles.p95}ms`,
        p99: `${metrics.percentiles.p99}ms`,
        successRate: `${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`
      });
    });
  });

  describe('Stress Testing', () => {
    it('should handle burst traffic', async () => {
      // Simulate sudden burst of traffic
      const burstSize = 200;
      
      const startTime = Date.now();

      const promises = Array(burstSize).fill(0).map(async () => {
        try {
          const response = await api.post('/increment', {}, {
            headers: { 'X-Request-ID': uuidv4() },
            timeout: 5000,
          });
          return response.status === 200;
        } catch {
          return false;
        }
      });

      const successes = (await Promise.all(promises)).filter(Boolean).length;
      const duration = Date.now() - startTime;

      expect(successes).toBeGreaterThan(burstSize * 0.7); // At least 70% success
      console.log(`Burst test: ${successes}/${burstSize} succeeded in ${duration}ms`);
    });

    it('should recover from sustained load', async () => {
      // Phase 1: Normal load
      let metrics = await measurePerformance('increment', 20, 5);
      const normalResponseTime = metrics.averageResponseTime;
      
      // Phase 2: Heavy sustained load
      await measurePerformance('increment', 150, 20);
      
      // Phase 3: Return to normal load (recovery test)
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
      metrics = await measurePerformance('increment', 20, 5);
      
      // Response time should recover to within 150% of normal
      expect(metrics.averageResponseTime).toBeLessThan(normalResponseTime * 1.5);
    });
  });

  describe('Endurance Testing', () => {
    it('should maintain performance over extended period', async () => {
      const testDuration = 30000; // 30 seconds
      const endTime = Date.now() + testDuration;
      const metrics: PerformanceMetrics[] = [];
      
      while (Date.now() < endTime) {
        const metric = await measurePerformance('increment', 10, 10);
        metrics.push(metric);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1s between batches
      }
      
      // Calculate performance degradation
      const firstBatch = metrics[0];
      const lastBatch = metrics[metrics.length - 1];
      
      // Performance shouldn't degrade more than 20%
      expect(lastBatch.averageResponseTime).toBeLessThan(firstBatch.averageResponseTime * 1.2);
      
      // Success rate should remain high
      const overallSuccessRate = metrics.reduce((acc, m) => 
        acc + (m.successfulRequests / m.totalRequests), 0) / metrics.length;
      expect(overallSuccessRate).toBeGreaterThan(0.95);
    });
  });

  describe('Concurrent Operation Tests', () => {
    it('should handle mixed increment/decrement operations under load', async () => {
      const operations = 1000;
      const startTime = Date.now();
      

      const promises = Array(operations).fill(0).map(async (_, i) => {
        const operation = i % 2 === 0 ? 'increment' : 'decrement';
        const requestStart = Date.now();
        
        try {
          const response = await api.post(`/${operation}`, {}, {
            headers: { 'X-Request-ID': uuidv4() }
          });
          
          return {
            success: response.status === 200,
            operation,
            time: Date.now() - requestStart,
          };
        } catch {
          return {
            success: false,
            operation,
            time: Date.now() - requestStart,
          };
        }
      });

      const operationResults = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      const incrementStats = operationResults.filter(r => r.operation === 'increment');
      const decrementStats = operationResults.filter(r => r.operation === 'decrement');
      
      const incrementSuccess = incrementStats.filter(r => r.success).length / incrementStats.length;
      const decrementSuccess = decrementStats.filter(r => r.success).length / decrementStats.length;
      
      // Both operations should have high success rates
      expect(incrementSuccess).toBeGreaterThan(0.9);
      expect(decrementSuccess).toBeGreaterThan(0.8); // Slightly lower due to bounds checking
      
      console.log('Mixed Operations Performance:', {
        totalOperations: operations,
        totalTime: `${totalTime}ms`,
        throughput: `${(operations / (totalTime / 1000)).toFixed(2)} ops/s`,
        incrementSuccessRate: `${(incrementSuccess * 100).toFixed(2)}%`,
        decrementSuccessRate: `${(decrementSuccess * 100).toFixed(2)}%`,
      });
    });
  });
});
