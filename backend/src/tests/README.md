# Backend Testing Guide

This directory contains comprehensive test suites for the Number Acidizer backend, focusing on ACID compliance and performance.

## Test Structure

```
src/tests/
├── api.e2e.test.ts        # End-to-end API tests
├── performance.test.ts     # Load and stress tests
├── dynamodb.service.test.ts # Unit tests for DynamoDB service
├── handlers.test.ts        # Unit tests for Lambda handlers
└── setup.ts               # Test configuration
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### E2E Tests
```bash
# Start the backend first
docker-compose up -d

# Run E2E tests
npm run test:e2e
```

### Performance Tests
```bash
# Requires backend to be running
npm run test:performance
```

### Test Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Test Categories

### 1. Unit Tests

**DynamoDB Service Tests** (`dynamodb.service.test.ts`)
- Counter initialization
- Increment/decrement operations
- Optimistic locking and retry logic
- Boundary conditions (0 and 1 billion)
- Error handling

**Handler Tests** (`handlers.test.ts`)
- Request validation
- Response formatting
- Error handling
- CORS headers
- WebSocket broadcast integration

### 2. E2E Tests (`api.e2e.test.ts`)

**Functional Tests**
- Basic increment/decrement operations
- Request ID validation
- Error responses

**ACID Compliance Tests**
- **Atomicity**: Concurrent operations complete fully or not at all
- **Consistency**: Boundaries enforced (0-1B range)
- **Isolation**: Concurrent requests don't interfere
- **Durability**: Values persist correctly

**Idempotency Tests**
- Same request ID prevents duplicate operations
- Ensures exactly-once processing

### 3. Performance Tests (`performance.test.ts`)

**Load Testing**
- Light load: 10 concurrent users
- Moderate load: 50 concurrent users
- Heavy load: 100 concurrent users

**Stress Testing**
- Burst traffic handling
- Recovery after sustained load

**Endurance Testing**
- Performance over extended periods
- Memory leak detection

**Metrics Collected**
- Response times (avg, min, max, percentiles)
- Throughput (requests/second)
- Success rates
- Error rates

## Test Configuration

### Environment Variables
Create a `.env.test` file:
```bash
API_URL=http://localhost:3001
ENVIRONMENT=test
AWS_REGION=us-east-1
```

### Local Testing Setup
```bash
# 1. Start local infrastructure
docker-compose up -d

# 2. Wait for services to be ready
sleep 5

# 3. Run tests
npm test
```

## Test Scenarios

### Increment API Tests
1. **Basic Success**: Increment by 1
2. **Missing Request ID**: Auto-generates UUID
3. **Invalid Request ID**: Returns 400 error
4. **Concurrent Requests**: 100 parallel increments
5. **Idempotency**: Same request ID used multiple times
6. **Maximum Boundary**: Cannot exceed 1 billion

### Decrement API Tests
1. **Basic Success**: Decrement by 1
2. **Zero Boundary**: Cannot go below 0
3. **Concurrent Requests**: 30 parallel decrements
4. **Idempotency**: Same request ID used multiple times
5. **Mixed Operations**: Increment/decrement cycles

### Performance Benchmarks

**Expected Results**:
- Light Load (10 users): <200ms avg response, >95% success
- Moderate Load (50 users): <500ms avg response, >90% success
- Heavy Load (100 users): <1s median response, >80% success
- Burst Traffic (200 requests): >70% success rate
- Throughput: >100 requests/second under normal load

## Debugging Tests

### Enable Debug Logs
```bash
DEBUG=true npm test
```

### Run Specific Test
```bash
npx jest -t "should increment counter successfully"
```

### Test a Specific File
```bash
npm test -- dynamodb.service.test.ts
```

## CI/CD Integration

The tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Unit Tests
  run: npm run test:unit
  
- name: Run E2E Tests
  run: |
    docker-compose up -d
    npm run test:e2e
    
- name: Upload Coverage
  run: npm run test:coverage
```

## Writing New Tests

### Unit Test Template
```typescript
describe('MyService', () => {
  let service: MyService;
  
  beforeEach(() => {
    // Setup
  });
  
  it('should do something', async () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = await service.doSomething(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### E2E Test Template
```typescript
it('should handle the full request cycle', async () => {
  const response = await api.post('/endpoint', {
    data: 'test'
  });
  
  expect(response.status).toBe(200);
  expect(response.data).toMatchObject({
    success: true,
    // ... other expectations
  });
});
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Kill process on port 3001
   lsof -ti:3001 | xargs kill -9
   ```

2. **DynamoDB Connection Failed**
   ```bash
   # Ensure DynamoDB is running
   docker ps | grep dynamodb
   ```

3. **Timeout Errors**
   - Increase Jest timeout in `jest.config.js`
   - Check if backend is responding

4. **Flaky Tests**
   - Add proper wait conditions
   - Increase retry attempts
   - Use `--runInBand` for sequential execution

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Reset state between tests
3. **Mocking**: Mock external dependencies in unit tests
4. **Assertions**: Use specific assertions, not generic truthy/falsy
5. **Performance**: Keep individual tests under 1 second
6. **Documentation**: Document complex test scenarios
7. **Error Cases**: Test both success and failure paths

## Continuous Improvement

- Monitor test execution times
- Track flaky tests
- Maintain >80% code coverage
- Review and update tests with code changes
- Add tests for bug fixes
