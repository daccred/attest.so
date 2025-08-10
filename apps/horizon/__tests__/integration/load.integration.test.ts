#!/usr/bin/env tsx

/**
 * Load Testing Script for Horizon API
 * Run with: npx tsx __tests__/load-test.ts
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.HORIZON_API_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/indexer`;

interface LoadTestResult {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errors: string[];
}

class LoadTester {
  private results: LoadTestResult[] = [];

  async makeRequest(url: string): Promise<{ success: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        // Consume response body to complete the request
        await response.text();
        return { success: true, responseTime };
      } else {
        return { success: false, responseTime, error: `HTTP ${response.status}` };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return { success: false, responseTime, error: error.message };
    }
  }

  async runLoadTest(
    endpoint: string, 
    concurrentUsers: number, 
    requestsPerUser: number,
    delayBetweenRequests = 100
  ): Promise<LoadTestResult> {
    const url = `${API_BASE}${endpoint}`;
    const totalRequests = concurrentUsers * requestsPerUser;
    
    console.log(`\n🔥 Load Testing: ${endpoint}`);
    console.log(`   Users: ${concurrentUsers}, Requests/User: ${requestsPerUser}, Total: ${totalRequests}`);
    
    const startTime = Date.now();
    const allResults: { success: boolean; responseTime: number; error?: string }[] = [];
    const errors: string[] = [];

    // Create concurrent user tasks
    const userTasks = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
      const userResults: { success: boolean; responseTime: number; error?: string }[] = [];
      
      for (let i = 0; i < requestsPerUser; i++) {
        if (delayBetweenRequests > 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
        }
        
        const result = await this.makeRequest(url);
        userResults.push(result);
        
        if (!result.success && result.error) {
          errors.push(result.error);
        }
        
        // Progress indicator
        const totalCompleted = userIndex * requestsPerUser + i + 1;
        if (totalCompleted % Math.max(1, Math.floor(totalRequests / 10)) === 0) {
          const progress = ((totalCompleted / totalRequests) * 100).toFixed(0);
          process.stdout.write(`\r   Progress: ${progress}% (${totalCompleted}/${totalRequests})`);
        }
      }
      
      return userResults;
    });

    // Execute all user tasks concurrently
    const userResultArrays = await Promise.all(userTasks);
    
    // Flatten results
    userResultArrays.forEach(userResults => {
      allResults.push(...userResults);
    });

    const endTime = Date.now();
    const totalTimeSeconds = (endTime - startTime) / 1000;
    
    // Calculate metrics
    const successfulRequests = allResults.filter(r => r.success).length;
    const failedRequests = allResults.length - successfulRequests;
    
    const responseTimes = allResults.map(r => r.responseTime).sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
    const minResponseTime = responseTimes[0] || 0;
    const maxResponseTime = responseTimes[responseTimes.length - 1] || 0;
    
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    const p95ResponseTime = responseTimes[p95Index] || 0;
    const p99ResponseTime = responseTimes[p99Index] || 0;
    
    const requestsPerSecond = totalRequests / totalTimeSeconds;

    const result: LoadTestResult = {
      endpoint,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      minResponseTime,
      maxResponseTime,
      requestsPerSecond,
      p95ResponseTime,
      p99ResponseTime,
      errors: [...new Set(errors)].slice(0, 10) // Unique errors, max 10
    };

    this.results.push(result);
    
    console.log(`\n   ✅ Completed in ${totalTimeSeconds.toFixed(1)}s`);
    console.log(`   Success Rate: ${((successfulRequests / totalRequests) * 100).toFixed(1)}%`);
    console.log(`   Avg Response: ${averageResponseTime.toFixed(0)}ms`);
    console.log(`   Requests/sec: ${requestsPerSecond.toFixed(1)}`);
    
    if (failedRequests > 0) {
      console.log(`   ⚠️  Failed Requests: ${failedRequests}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? '...' : ''}`);
      }
    }

    return result;
  }

  async runStressTest() {
    console.log('🔥 STRESS TESTING - High Concurrency');
    
    // Gradual load increase
    const testScenarios = [
      { users: 5, requestsPerUser: 10, delay: 50 },
      { users: 10, requestsPerUser: 10, delay: 50 },
      { users: 20, requestsPerUser: 5, delay: 25 },
      { users: 50, requestsPerUser: 2, delay: 0 }
    ];

    for (const scenario of testScenarios) {
      await this.runLoadTest('/events?limit=10', scenario.users, scenario.requestsPerUser, scenario.delay);
      // Brief pause between scenarios
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async runEndpointLoadTests() {
    console.log('📊 ENDPOINT LOAD TESTING');
    
    const testEndpoints = [
      '/health',
      '/events?limit=20',
      '/transactions?limit=20',
      '/operations?limit=20',
      '/analytics?timeframe=24h',
      '/activity?limit=10'
    ];

    for (const endpoint of testEndpoints) {
      await this.runLoadTest(endpoint, 10, 5, 100);
      // Brief pause between endpoints
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async runSustainedLoadTest() {
    console.log('⏱️  SUSTAINED LOAD TEST');
    
    // 5 minutes of sustained load
    const durationMinutes = 2; // Reduced for testing
    const requestsPerMinute = 60;
    const totalRequests = durationMinutes * requestsPerMinute;
    const intervalMs = (durationMinutes * 60 * 1000) / totalRequests;

    console.log(`Running sustained load for ${durationMinutes} minutes...`);
    console.log(`Target: ${requestsPerMinute} requests/minute (${intervalMs}ms interval)`);

    const startTime = Date.now();
    const results: { success: boolean; responseTime: number; error?: string }[] = [];
    let requestCount = 0;

    const intervalId = setInterval(async () => {
      requestCount++;
      const result = await this.makeRequest(`${API_BASE}/events?limit=5`);
      results.push(result);

      if (requestCount % 10 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const successRate = ((results.filter(r => r.success).length / results.length) * 100).toFixed(1);
        console.log(`   ${elapsed}min: ${requestCount}/${totalRequests} requests, ${successRate}% success`);
      }

      if (requestCount >= totalRequests) {
        clearInterval(intervalId);
        
        const totalTime = (Date.now() - startTime) / 1000;
        const successfulRequests = results.filter(r => r.success).length;
        const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
        
        console.log(`\n   ✅ Sustained test completed:`);
        console.log(`   Total Time: ${totalTime.toFixed(1)}s`);
        console.log(`   Success Rate: ${((successfulRequests / totalRequests) * 100).toFixed(1)}%`);
        console.log(`   Avg Response: ${avgResponseTime.toFixed(0)}ms`);
        console.log(`   Actual RPS: ${(totalRequests / totalTime).toFixed(1)}`);
      }
    }, intervalMs);

    // Wait for completion
    await new Promise<void>(resolve => {
      const checkInterval = setInterval(() => {
        if (requestCount >= totalRequests) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }

  printSummary() {
    console.log('\n📈 LOAD TEST SUMMARY\n');
    
    if (this.results.length === 0) {
      console.log('No load test results to display.');
      return;
    }

    console.log('Endpoint Performance:');
    console.log('─'.repeat(80));
    console.log('Endpoint'.padEnd(30) + 
                'Requests'.padEnd(10) + 
                'Success%'.padEnd(10) + 
                'Avg(ms)'.padEnd(10) + 
                'P95(ms)'.padEnd(10) + 
                'RPS'.padEnd(10));
    console.log('─'.repeat(80));

    this.results.forEach(result => {
      const successRate = ((result.successfulRequests / result.totalRequests) * 100).toFixed(1);
      
      console.log(
        result.endpoint.padEnd(30) +
        result.totalRequests.toString().padEnd(10) +
        `${successRate}%`.padEnd(10) +
        result.averageResponseTime.toFixed(0).padEnd(10) +
        result.p95ResponseTime.toFixed(0).padEnd(10) +
        result.requestsPerSecond.toFixed(1).padEnd(10)
      );
    });

    // Performance insights
    console.log('\n🎯 Performance Insights:');
    
    const slowEndpoints = this.results
      .filter(r => r.averageResponseTime > 1000)
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime);
      
    if (slowEndpoints.length > 0) {
      console.log('\n🐌 Slow Endpoints (>1s avg):');
      slowEndpoints.forEach(r => {
        console.log(`   ${r.endpoint}: ${r.averageResponseTime.toFixed(0)}ms avg`);
      });
    }

    const highErrorEndpoints = this.results
      .filter(r => r.failedRequests > 0)
      .sort((a, b) => b.failedRequests - a.failedRequests);
      
    if (highErrorEndpoints.length > 0) {
      console.log('\n❌ Endpoints with Errors:');
      highErrorEndpoints.forEach(r => {
        const errorRate = ((r.failedRequests / r.totalRequests) * 100).toFixed(1);
        console.log(`   ${r.endpoint}: ${r.failedRequests} failures (${errorRate}%)`);
        if (r.errors.length > 0) {
          console.log(`      Errors: ${r.errors.slice(0, 2).join(', ')}`);
        }
      });
    }

    const bestPerformers = this.results
      .filter(r => r.failedRequests === 0 && r.averageResponseTime < 500)
      .sort((a, b) => a.averageResponseTime - b.averageResponseTime);
      
    if (bestPerformers.length > 0) {
      console.log('\n⚡ Best Performing Endpoints:');
      bestPerformers.slice(0, 3).forEach(r => {
        console.log(`   ${r.endpoint}: ${r.averageResponseTime.toFixed(0)}ms avg, ${r.requestsPerSecond.toFixed(1)} RPS`);
      });
    }
  }
}

async function main() {
  console.log('🚀 Horizon API Load Testing Suite');
  console.log(`🌐 Base URL: ${API_BASE}\n`);
  
  const tester = new LoadTester();
  
  try {
    // Check if server is available
    console.log('Checking server availability...');
    const healthCheck = await tester.makeRequest(`${API_BASE}/health`);
    if (!healthCheck.success) {
      console.error(`❌ Server not available: ${healthCheck.error}`);
      console.error('Make sure the Horizon server is running before running load tests.');
      process.exit(1);
    }
    console.log('✅ Server is available');

    await tester.runEndpointLoadTests();
    await tester.runStressTest();
    await tester.runSustainedLoadTest();
    
    tester.printSummary();
    
    console.log('\n✅ Load testing completed!');
    
  } catch (error: any) {
    console.error('\n💥 Load test suite failed:', error.message);
    process.exit(1);
  }
}

// Check if this file is being run directly
if (require.main === module) {
  main().catch(console.error);
}

export { LoadTester };