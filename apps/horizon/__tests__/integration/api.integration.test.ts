#!/usr/bin/env tsx

/**
 * Manual API Testing Script
 * Run with: npx tsx __tests__/manual-test-runner.ts
 */

import fetch from 'node-fetch';

// Configuration
const BASE_URL = process.env.HORIZON_API_URL || 'http://localhost:3001';
const API_BASE = `${BASE_URL}`;

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  error?: string;
  responseTime: number;
  data?: any;
}

class APITester {
  private results: TestResult[] = [];

  async testEndpoint(
    endpoint: string, 
    method: 'GET' | 'POST' = 'GET', 
    body?: any,
    expectedStatus = 200
  ): Promise<TestResult> {
    const url = `${API_BASE}${endpoint}`;
    const startTime = Date.now();
    
    try {
      console.log(`Testing ${method} ${endpoint}...`);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      
      const responseTime = Date.now() - startTime;
      const contentType = response.headers.get('content-type');
      let data: any;
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      const result: TestResult = {
        endpoint,
        method,
        status: response.status,
        success: response.status === expectedStatus,
        responseTime,
        data
      };
      
      this.results.push(result);
      
      if (result.success) {
        console.log(`  ✅ ${response.status} (${responseTime}ms)`);
      } else {
        console.log(`  ❌ ${response.status} (expected ${expectedStatus}) (${responseTime}ms)`);
        if (data?.error) {
          console.log(`     Error: ${data.error}`);
          result.error = data.error;
        }
      }
      
      return result;
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const result: TestResult = {
        endpoint,
        method,
        status: 0,
        success: false,
        error: error.message,
        responseTime
      };
      
      this.results.push(result);
      console.log(`  ❌ Network Error: ${error.message} (${responseTime}ms)`);
      return result;
    }
  }

  async runHealthChecks() {
    console.log('\n🔍 Running Health Checks...\n');
    
    await this.testEndpoint('/api/health');
  }

  async runBasicAPITests() {
    console.log('\n📊 Running Basic API Tests...\n');
    
    // Test events API
    await this.testEndpoint('/api/data/events');
    await this.testEndpoint('/api/data/events?limit=10');
    await this.testEndpoint('/api/data/events?eventType=ATTEST');
    await this.testEndpoint('/api/data/events?ledgerStart=1000000');
    
    // Test transactions API
    await this.testEndpoint('/api/data/transactions');
    await this.testEndpoint('/api/data/transactions?limit=5');
    await this.testEndpoint('/api/data/transactions?successful=true');
    
    // Test operations API
    await this.testEndpoint('/api/data/operations');
    await this.testEndpoint('/api/data/operations?type=invoke_host_function');
    
    // Test effects API
    await this.testEndpoint('/api/data/effects');
    
    // Test contract data API
    await this.testEndpoint('/api/data/contract-data');
    await this.testEndpoint('/api/data/contract-data?latest=true');
    
    // Test accounts API
    await this.testEndpoint('/api/data/accounts');
    await this.testEndpoint('/api/data/accounts?isContract=true');
    
    // Test payments API
    await this.testEndpoint('/api/data/payments');
    
    // Test analytics API
    await this.testEndpoint('/api/analytics');
    await this.testEndpoint('/api/analytics?timeframe=1h');
    await this.testEndpoint('/api/analytics?timeframe=7d');
    
    // Test activity API
    await this.testEndpoint('/api/analytics/activity');
    await this.testEndpoint('/api/analytics/activity?limit=10');
  }

  async runDataIngestionTests() {
    console.log('\n⚡ Running Data Ingestion Tests...\n');
    
    // Test event ingestion
    await this.testEndpoint('/api/ingest/events', 'POST', {}, 202);
    await this.testEndpoint('/api/ingest/events', 'POST', { startLedger: 1000000 }, 202);
    
    // Test comprehensive ingestion
    await this.testEndpoint('/api/ingest/comprehensive', 'POST', {}, 202);
    await this.testEndpoint('/api/ingest/comprehensive', 'POST', { startLedger: 1000000 }, 202);
  }

  async runErrorHandlingTests() {
    console.log('\n⚠️ Running Error Handling Tests...\n');
    
    // Test invalid parameters
    await this.testEndpoint('/api/data/events?limit=abc', 'GET', undefined, 200); // Should handle gracefully
    await this.testEndpoint('/api/data/events?ledgerStart=invalid', 'GET', undefined, 200);
    
    // Test invalid ingestion parameters
    await this.testEndpoint('/api/ingest/events', 'POST', { startLedger: 'invalid' }, 400);
    
    // Test non-existent endpoints
    await this.testEndpoint('/api/nonexistent', 'GET', undefined, 404);
    
    // Test invalid JSON
    try {
      const response = await fetch(`${API_BASE}/api/ingest/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"invalid": json}'
      });
      console.log(`  Invalid JSON test: ${response.status}`);
    } catch (error: any) {
      console.log(`  Invalid JSON test: Network error - ${error.message}`);
    }
  }

  async runPerformanceTests() {
    console.log('\n🚀 Running Performance Tests...\n');
    
    // Test large limit requests
    await this.testEndpoint('/api/data/events?limit=200');
    await this.testEndpoint('/api/data/transactions?limit=200');
    
    // Test concurrent requests
    console.log('Testing concurrent requests...');
    const concurrentTests = Array(5).fill(null).map(() => 
      this.testEndpoint('/api/data/events?limit=50')
    );
    
    const results = await Promise.all(concurrentTests);
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
    console.log(`  Average response time: ${avgResponseTime.toFixed(0)}ms`);
  }

  async runContractSpecificTests() {
    console.log('\n🔗 Running Contract-Specific Tests...\n');
    
    const contractId = 'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO';
    
    await this.testEndpoint(`/api/data/events?contractId=${contractId}`);
    await this.testEndpoint(`/api/data/transactions?sourceAccount=${contractId.slice(0, 56)}`);
    await this.testEndpoint(`/api/analytics?contractId=${contractId}`);
    await this.testEndpoint(`/api/analytics/activity?contractId=${contractId}`);
    await this.testEndpoint(`/api/data/contract-data?contractId=${contractId}`);
  }

  printSummary() {
    console.log('\n📈 Test Summary\n');
    
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    const avgResponseTime = this.results
      .filter(r => r.responseTime > 0)
      .reduce((sum, r) => sum + r.responseTime, 0) / totalTests;
    console.log(`Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
    
    // Show failures
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  ${r.method} ${r.endpoint} - ${r.status} ${r.error ? `(${r.error})` : ''}`);
        });
    }
    
    // Show slow endpoints
    const slowTests = this.results
      .filter(r => r.responseTime > 2000)
      .sort((a, b) => b.responseTime - a.responseTime);
      
    if (slowTests.length > 0) {
      console.log('\n🐌 Slow Endpoints (>2s):');
      slowTests.forEach(r => {
        console.log(`  ${r.method} ${r.endpoint} - ${r.responseTime}ms`);
      });
    }
    
    // Show data sample from successful requests
    const successfulWithData = this.results
      .filter(r => r.success && r.data && typeof r.data === 'object' && r.data.data)
      .slice(0, 3);
      
    if (successfulWithData.length > 0) {
      console.log('\n📊 Sample Data (first 3 successful requests):');
      successfulWithData.forEach(r => {
        const data = r.data;
        if (data.data && Array.isArray(data.data)) {
          console.log(`  ${r.endpoint}: ${data.data.length} items`);
          if (data.pagination) {
            console.log(`    Total: ${data.pagination.total}, HasMore: ${data.pagination.hasMore}`);
          }
        } else if (data.data) {
          console.log(`  ${r.endpoint}: ${Object.keys(data.data).join(', ')}`);
        }
      });
    }
  }

  generateCurlCommands() {
    console.log('\n🔧 Sample cURL Commands:\n');
    
    const sampleEndpoints = [
      '/api/health',
      '/api/data/events?limit=10',
      '/api/data/transactions?successful=true&limit=5',
      '/api/analytics?timeframe=24h',
      '/api/analytics/activity?limit=20'
    ];
    
    sampleEndpoints.forEach(endpoint => {
      console.log(`curl "${API_BASE}${endpoint}"`);
    });
    
    console.log('\n# Data ingestion:');
    console.log(`curl -X POST "${API_BASE}/api/ingest/events" -H "Content-Type: application/json" -d '{"startLedger": 1000000}'`);
    console.log(`curl -X POST "${API_BASE}/api/ingest/comprehensive" -H "Content-Type: application/json" -d '{"startLedger": 1000000}'`);
  }
}

// Main execution
async function main() {
  console.log('🧪 Horizon API Manual Testing Suite');
  console.log(`🌐 Base URL: ${API_BASE}\n`);
  
  const tester = new APITester();
  
  try {
    await tester.runHealthChecks();
    await tester.runBasicAPITests();
    await tester.runDataIngestionTests();
    await tester.runErrorHandlingTests();
    await tester.runPerformanceTests();
    await tester.runContractSpecificTests();
    
    tester.printSummary();
    tester.generateCurlCommands();
    
  } catch (error: any) {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Check if this file is being run directly
if (require.main === module) {
  main().catch(console.error);
}

export { APITester };