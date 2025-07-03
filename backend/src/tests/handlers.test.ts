import { handler as incrementHandler } from '../handlers/increment';
import { handler as decrementHandler } from '../handlers/decrement';
import { DynamoDBService } from '../services/dynamodb.service';
import { WebSocketService } from '../services/websocket.service';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock services
jest.mock('../services/dynamodb.service');
jest.mock('../services/websocket.service');

describe('Lambda Handlers', () => {
  let mockDynamoDBService: jest.Mocked<DynamoDBService>;
  let mockWebSocketService: jest.Mocked<WebSocketService>;
  let mockContext: Context;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock context
    mockContext = {
      awsRequestId: 'test-request-id',
      functionName: 'test-function',
      functionVersion: '1.0',
      getRemainingTimeInMillis: () => 30000,
    } as any;
  });

  const createMockEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
    httpMethod: 'POST',
    path: '/test',
    headers: {
      'x-request-id': 'test-request-123',
      'x-client-id': 'test-client',
    },
    body: null,
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: 'test-account',
      apiId: 'test-api',
      httpMethod: 'POST',
      identity: {
        sourceIp: '127.0.0.1',
      },
      path: '/test',
      stage: 'test',
      requestId: 'test-request',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/test',
    } as any,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    ...overrides,
  });

  describe('Increment Handler', () => {
    it('should increment counter successfully', async () => {
      const mockEvent = createMockEvent();
      
      // Mock service methods
      DynamoDBService.prototype.incrementCounter = jest.fn().mockResolvedValue(10);
      WebSocketService.prototype.broadcastUpdate = jest.fn().mockResolvedValue(undefined);

      const result = await incrementHandler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.value).toBe(10);
      expect(body.requestId).toBe('test-request-123');
      
      expect(DynamoDBService.prototype.incrementCounter).toHaveBeenCalledWith('test-request-123');
      expect(WebSocketService.prototype.broadcastUpdate).toHaveBeenCalledWith({
        value: 10,
        operation: 'increment',
        clientId: 'test-client',
      });
    });

    it('should generate request ID if not provided', async () => {
      const mockEvent = createMockEvent({ headers: {} });
      
      DynamoDBService.prototype.incrementCounter = jest.fn().mockResolvedValue(5);
      WebSocketService.prototype.broadcastUpdate = jest.fn().mockResolvedValue(undefined);

      const result = await incrementHandler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should handle value out of bounds error', async () => {
      const mockEvent = createMockEvent();
      
      DynamoDBService.prototype.incrementCounter = jest.fn()
        .mockRejectedValue(new Error('Value out of bounds: 1000000001'));

      const result = await incrementHandler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('VALUE_OUT_OF_BOUNDS');
      expect(body.message).toContain('maximum limit');
    });

    it('should handle general errors', async () => {
      const mockEvent = createMockEvent();
      
      DynamoDBService.prototype.incrementCounter = jest.fn()
        .mockRejectedValue(new Error('Database connection failed'));

      const result = await incrementHandler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('INTERNAL_ERROR');
    });

    it('should validate request ID format', async () => {
      const mockEvent = createMockEvent({
        headers: { 'x-request-id': 'invalid-uuid-format' }
      });
      
      const result = await incrementHandler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('Invalid request ID format');
    });
  });

  describe('Decrement Handler', () => {
    it('should decrement counter successfully', async () => {
      const mockEvent = createMockEvent();
      
      DynamoDBService.prototype.decrementCounter = jest.fn().mockResolvedValue(8);
      WebSocketService.prototype.broadcastUpdate = jest.fn().mockResolvedValue(undefined);

      const result = await decrementHandler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.value).toBe(8);
      
      expect(DynamoDBService.prototype.decrementCounter).toHaveBeenCalledWith('test-request-123');
      expect(WebSocketService.prototype.broadcastUpdate).toHaveBeenCalledWith({
        value: 8,
        operation: 'decrement',
        clientId: 'test-client',
      });
    });

    it('should handle value below zero error', async () => {
      const mockEvent = createMockEvent();
      
      DynamoDBService.prototype.decrementCounter = jest.fn()
        .mockRejectedValue(new Error('Value out of bounds: -1'));

      const result = await decrementHandler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('VALUE_OUT_OF_BOUNDS');
      expect(body.message).toContain('cannot go below zero');
    });

    it('should handle WebSocket broadcast failures gracefully', async () => {
      const mockEvent = createMockEvent();
      
      DynamoDBService.prototype.decrementCounter = jest.fn().mockResolvedValue(5);
      WebSocketService.prototype.broadcastUpdate = jest.fn()
        .mockRejectedValue(new Error('WebSocket broadcast failed'));

      // Should still return success even if broadcast fails
      const result = await decrementHandler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.value).toBe(5);
    });
  });

  describe('CORS Headers', () => {
    it('should include proper CORS headers in response', async () => {
      const mockEvent = createMockEvent();
      
      DynamoDBService.prototype.incrementCounter = jest.fn().mockResolvedValue(10);
      WebSocketService.prototype.broadcastUpdate = jest.fn().mockResolvedValue(undefined);

      const result = await incrementHandler(mockEvent, mockContext);

      expect(result.headers).toEqual({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Request-ID,X-Client-ID',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      });
    });
  });
});
