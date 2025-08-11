# Horizon API Testing Guide

## Overview

This comprehensive testing suite ensures the reliability, performance, and correctness of all Horizon API endpoints. The testing framework includes unit tests, integration tests, manual testing, and load testing.

## Test Structure

```
__tests__/
├── fixtures/
│   └── test-data.ts           # Shared mock data and fixtures
├── unit/
│   └── database-functions.test.ts  # Database layer unit tests
└── integration/
    ├── events.test.ts         # Events API integration tests
    ├── transactions.test.ts   # Transactions API integration tests
    ├── analytics.test.ts      # Analytics API integration tests
    ├── endpoints.test.ts      # Comprehensive endpoint tests
    ├── horizon.test.ts        # Health and ingestion tests
    ├── manual-test-runner.ts  # End-to-end manual testing
    └── load-test.ts          # Performance and load testing
```

## Test Types

### 1. Unit Tests (`__tests__/unit/`)
Tests individual functions and modules in isolation with mocked dependencies.

**Coverage:**
- Database connection management
- CRUD operations for all Horizon models
- Error handling scenarios
- Data validation and transformation

**Run:**
```bash
pnpm test:unit
```

### 2. Integration Tests (`__tests__/integration/`)
Test API endpoints and system components with mocked external dependencies.

**Test Files:**
- `events.test.ts` - Events endpoint testing
- `transactions.test.ts` - Transactions endpoint testing  
- `analytics.test.ts` - Analytics endpoint testing
- `endpoints.test.ts` - Comprehensive endpoint testing
- `horizon.test.ts` - Basic health and ingestion tests

**Coverage:**
- All REST API endpoints
- Request/response validation
- Query parameter handling
- Error scenarios
- Pagination logic

**Run:**
```bash
pnpm test:integration
# or run all tests
pnpm test
```

### 3. Manual API Testing (`__tests__/integration/manual-test-runner.ts`)
End-to-end testing against a running server instance.

**Features:**
- Tests all endpoints with real HTTP requests
- Validates response formats and data
- Performance measurement
- Error handling verification
- Generates cURL command examples

**Run:**
```bash
# Start the server first
pnpm dev

# In another terminal
pnpm test:manual
```

**Example Output:**
```
🧪 Horizon API Manual Testing Suite
🌐 Base URL: http://localhost:3000/api/indexer

🔍 Running Health Checks...
Testing GET /health...
  ✅ 200 (45ms)

📊 Running Basic API Tests...
Testing GET /events...
  ✅ 200 (123ms)
Testing GET /events?limit=10...
  ✅ 200 (67ms)

📈 Test Summary
Total Tests: 25
Passed: 23 ✅
Failed: 2 ❌
Success Rate: 92.0%
Average Response Time: 156ms
```

### 4. Load Testing (`__tests__/integration/load-test.ts`)
Performance and stress testing to identify bottlenecks.

**Test Scenarios:**
- **Endpoint Load Testing**: Multiple concurrent requests per endpoint
- **Stress Testing**: Gradual load increase to find breaking points  
- **Sustained Load Testing**: Extended duration testing
- **Concurrent User Simulation**: Real-world usage patterns

**Run:**
```bash
# Start the server first
pnpm dev

# In another terminal  
pnpm test:load
```

**Example Output:**
```
🚀 Horizon API Load Testing Suite

📊 ENDPOINT LOAD TESTING
🔥 Load Testing: /events?limit=20
   Users: 10, Requests/User: 5, Total: 50
   Progress: 100% (50/50)
   ✅ Completed in 2.3s
   Success Rate: 100.0%
   Avg Response: 245ms
   Requests/sec: 21.7

📈 LOAD TEST SUMMARY
Endpoint Performance:
─────────────────────────────────────────
Endpoint                      Requests  Success%  Avg(ms)   P95(ms)   RPS       
─────────────────────────────────────────
/events?limit=20              50        100.0%    245       389       21.7      
/transactions?limit=20        50        100.0%    178       267       28.1      
```

## Quick Testing Commands

```bash
# Install dependencies
pnpm install

# Run all unit and integration tests
pnpm test

# Run with coverage report
pnpm coverage

# Run tests in watch mode (for development)
pnpm test:watch

# Run specific test files
pnpm test events
pnpm test transactions
pnpm test analytics
pnpm test database-functions

# Run manual API testing (requires running server)
pnpm test:manual

# Run load testing (requires running server)
pnpm test:load

# Run comprehensive test suite
pnpm test:all
```

## Test Data and Fixtures

All tests use consistent mock data defined in `__tests__/fixtures/test-data.ts`:

- `mockHorizonEvent` - Sample contract event
- `mockHorizonTransaction` - Sample transaction with Soroban data
- `mockHorizonOperation` - Sample contract operation
- `mockHorizonEffect` - Sample state change effect
- `mockHorizonContractData` - Sample contract storage data
- `mockHorizonAccount` - Sample account with contract info
- `mockHorizonPayment` - Sample payment transaction

## Testing Enhanced Contract-Specific Endpoints

### Health Check Testing
```bash
# Test system health
curl "http://localhost:3001/api/indexer/health"

# Check queue status
curl "http://localhost:3001/api/indexer/queue/status"
```

### Events API Testing
```bash
# Test events endpoint specifically
curl "http://localhost:3001/api/indexer/events?limit=10"
curl "http://localhost:3001/api/indexer/events?contractId=CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM"
curl "http://localhost:3001/api/indexer/events?eventType=ATTEST&ledgerStart=880500"
```

### Enhanced Contract Operations API Testing (NEW)
```bash
# Test contract operations endpoint
curl "http://localhost:3001/api/indexer/contract-operations?limit=10"
curl "http://localhost:3001/api/indexer/contract-operations?successful=true&limit=5"
curl "http://localhost:3001/api/indexer/contract-operations?contractId=CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM"
curl "http://localhost:3001/api/indexer/contract-operations?operationType=invoke_host_function"
```

### Transactions API Testing
```bash
# Test transactions endpoint
curl "http://localhost:3001/api/indexer/transactions?limit=5"
curl "http://localhost:3001/api/indexer/transactions?successful=true"
curl "http://localhost:3001/api/indexer/transactions?sourceAccount=GDAQ..."
```

### Enhanced Analytics API Testing (NEW)
```bash
# Test contract analytics dashboard
curl "http://localhost:3001/api/indexer/contracts/analytics"

# Test general analytics
curl "http://localhost:3001/api/indexer/analytics?timeframe=7d"
curl "http://localhost:3001/api/indexer/analytics?contractId=CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM"
```

### Enhanced Data Ingestion Testing

#### Comprehensive Contract Ingestion (Recommended)
```bash
# Test comprehensive contract data ingestion
curl -X POST "http://localhost:3001/api/indexer/contracts/comprehensive/ingest" \
     -H "Content-Type: application/json" \
     -d '{"startLedger": 880500}'

# Test with specific contracts
curl -X POST "http://localhost:3001/api/indexer/contracts/comprehensive/ingest" \
     -H "Content-Type: application/json" \
     -d '{"startLedger": 880500, "contractIds": ["CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM"]}'
```

#### Contract Operations Ingestion (NEW)
```bash
# Test contract operations ingestion
curl -X POST "http://localhost:3001/api/indexer/contracts/operations/ingest" \
     -H "Content-Type: application/json" \
     -d '{"startLedger": 880500, "includeFailedTx": true}'
```

#### Event Ingestion (Legacy)
```bash
# Test event ingestion (legacy approach)
curl -X POST "http://localhost:3001/api/indexer/events/ingest" \
     -H "Content-Type: application/json" \
     -d '{"startLedger": 880500}'
```

### Activity Feed Testing
```bash
# Test activity feed
curl "http://localhost:3001/api/indexer/activity?limit=20"
curl "http://localhost:3001/api/indexer/activity?contractId=CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM"
```

## Testing Enhanced Indexing Strategy

### Complete Integration Test Flow

Test the full enhanced indexing strategy with these sequential commands:

```bash
# 1. Check system health
curl "http://localhost:3001/api/indexer/health"

# 2. Start comprehensive contract indexing (recommended approach)
curl -X POST "http://localhost:3001/api/indexer/contracts/comprehensive/ingest" \
     -H "Content-Type: application/json" \
     -d '{"startLedger": 880500}'

# 3. Monitor queue processing
curl "http://localhost:3001/api/indexer/queue/status"

# 4. After processing completes, check contract operations
curl "http://localhost:3001/api/indexer/contract-operations?limit=5"

# 5. View contract analytics
curl "http://localhost:3001/api/indexer/contracts/analytics"

# 6. Check activity feed
curl "http://localhost:3001/api/indexer/activity?limit=10"

# 7. Verify data completeness with events
curl "http://localhost:3001/api/indexer/events?limit=5"

# 8. Check transactions
curl "http://localhost:3001/api/indexer/transactions?limit=5"
```

### Validation Checklist

After running the enhanced indexing, verify:

- ✅ **Contract Operations**: Successfully stored in `HorizonContractOperation` table
- ✅ **Events**: Linked to contract operations via relations  
- ✅ **Transactions**: Complete transaction details with Soroban resource usage
- ✅ **Failed Operations**: Failed operations tracked for debugging
- ✅ **Analytics**: Success rates and user metrics calculated correctly
- ✅ **Performance**: Response times under acceptable thresholds

### Contract-Specific Testing

Test both tracked contracts individually:

```bash
# Protocol Contract Testing
PROTOCOL_CONTRACT="CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM"

curl "http://localhost:3001/api/indexer/contract-operations?contractId=$PROTOCOL_CONTRACT&limit=5"
curl "http://localhost:3001/api/indexer/events?contractId=$PROTOCOL_CONTRACT&limit=5"

# Authority Contract Testing  
AUTHORITY_CONTRACT="CAD6YMZCO4Q3L5XZT2FD3MDHP3ZHFMYL24RZYG4YQAL4XQKVGVXYPSQQ"

curl "http://localhost:3001/api/indexer/contract-operations?contractId=$AUTHORITY_CONTRACT&limit=5"
curl "http://localhost:3001/api/indexer/events?contractId=$AUTHORITY_CONTRACT&limit=5"
```

## Environment Setup for Testing

### Local Development
```bash
# Copy environment file
cp .env.sample .env

# Update DATABASE_URL for testing
DATABASE_URL="postgresql://test:test@localhost:5432/horizon_test"

# Run database migrations
pnpm prisma:migrate:dev

# Start development server
pnpm dev
```

### Test Database
For integration tests, consider using a separate test database:

```bash
# Set test database URL
export DATABASE_URL="postgresql://test:test@localhost:5432/horizon_test"

# Run migrations on test database
pnpm prisma:migrate:dev
```

### CI/CD Testing
```bash
# Run tests suitable for CI environment
pnpm test:ci

# This includes:
# - All unit and integration tests
# - Coverage reporting
# - Verbose output for debugging
```

## Performance Benchmarks

Based on load testing, expected performance characteristics:

### Acceptable Performance Thresholds
- **Response Time**: < 500ms average for most endpoints
- **P95 Response Time**: < 1000ms  
- **Success Rate**: > 99%
- **Throughput**: > 50 requests/second per endpoint
- **Error Rate**: < 1%

### Heavy Endpoints (Expected Slower)
- `/analytics` - Complex aggregations (< 2000ms acceptable)
- `/comprehensive/ingest` - Background processing (202 response)
- Large pagination requests (limit > 100)

## Troubleshooting Test Issues

### Common Issues

**Tests failing with "Database not available":**
```bash
# Check database connection
pnpm prisma:studio

# Regenerate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate:dev
```

**Manual tests failing with connection errors:**
```bash
# Make sure server is running
pnpm dev

# Check server logs for errors
# Verify DATABASE_URL is set correctly
```

**Load tests showing poor performance:**
- Check database connection pool settings
- Monitor system resources (CPU, memory)
- Review database query performance
- Check network latency to database

### Debugging Failed Tests

1. **Check test output** - Vitest provides detailed error messages
2. **Review server logs** - Look for database or RPC errors
3. **Verify test data** - Ensure mock data matches expected schema
4. **Check environment variables** - Verify all required env vars are set
5. **Database state** - Make sure test database is in clean state

### Performance Debugging

```bash
# Run tests with performance timing
VITEST_REPORTER=verbose pnpm test

# Run load tests with different parameters
HORIZON_API_URL=http://localhost:3000 pnpm test:load

# Monitor database during tests
pnpm prisma:studio
```

## Writing New Tests

### Adding Unit Tests
1. Create new test file in `__tests__/unit/[module].test.ts`
2. Import test fixtures from `../fixtures/test-data.ts`
3. Mock external dependencies only
4. Test individual functions in isolation
5. Focus on edge cases and error scenarios

### Adding Integration Tests
1. Create new test file in `__tests__/integration/[feature].test.ts`
2. Import test fixtures from `../fixtures/test-data.ts`
3. Mock database and external APIs
4. Test API endpoints end-to-end
5. Test happy path, error cases, and edge cases

### Adding Load Tests  
1. Add new endpoint to `__tests__/integration/load-test.ts`
2. Define appropriate concurrency levels
3. Set performance expectations
4. Add to automated test scenarios

### Test File Structure
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockDb, TEST_CONSTANTS } from '../fixtures/test-data';

describe('Feature API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
  });

  describe('GET /endpoint', () => {
    it('should return expected data', async () => {
      // Test implementation
    });
    
    it('should handle errors gracefully', async () => {
      // Error scenario testing
    });
  });
});
```

This comprehensive testing framework ensures the Horizon API is reliable, performant, and ready for production use.