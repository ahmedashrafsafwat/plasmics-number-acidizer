import { DynamoDBService } from '../services/dynamodb.service';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('DynamoDBService', () => {
  let service: DynamoDBService;
  let mockDocClient: jest.Mocked<DynamoDBDocumentClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.fn().mockReset();

    mockDocClient = {
      send: jest.fn(),
      config: {} as any, // Mocking config as an empty object
      destroy: jest.fn(),
      middlewareStack: {} as any, // Mocking middlewareStack as an empty object
      // initConfig is optional, so it's not strictly needed to be mocked
    };

    (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue(mockDocClient);
    service = new DynamoDBService();
  });

  describe('getCounter', () => {
    it('should return existing counter value', async () => {
      const mockValue = { value: 42, version: 5 };
      mockDocClient.send.mockImplementation(async (command: any) => {
        if (command instanceof GetCommand) {
          return { Item: mockValue };
        }
        return {};
      });

      const result = await service.getCounter();

      expect(result).toEqual(mockValue);
      expect(mockDocClient.send).toHaveBeenCalledWith(expect.any(GetCommand));
    });

    it('should initialize counter if not exists', async () => {
      mockDocClient.send
        .mockImplementation(async () => {
          return { Item: undefined };
        })
        .mockImplementation(async () => {
          return {};
        }); // UpdateCommand succeeds

      const result = await service.getCounter();

      expect(result).toEqual({ value: 0, version: 1 });
      expect(mockDocClient.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('incrementCounter', () => {
    it('should increment counter successfully', async () => {
      const requestId = 'test-request-123';

      mockDocClient.send
        .mockImplementationOnce(async () => {
          return { Item: { value: 5, version: 1 } };
        }) // getCounter
        .mockImplementationOnce(async () => {
          return {};
        }); // TransactWriteCommand succeeds

      const result = await service.incrementCounter(requestId);

      expect(result).toBe(6);
      expect(mockDocClient.send).toHaveBeenCalledWith(expect.any(TransactWriteCommand));
    });

    it('should handle optimistic locking conflicts with retry', async () => {
      const requestId = 'test-request-123';

      mockDocClient.send
        .mockImplementationOnce(async () => {
          return { Item: { value: 5, version: 1 } };
        })
        .mockImplementationOnce(async () => {
          return new ConditionalCheckFailedException({
            message: 'Conditional check failed',
            $metadata: {},
          });
        })
        .mockImplementationOnce(async () => {
          return { Item: { value: 6, version: 2 } }; // Retry getCounter
        })
        .mockImplementationOnce(async () => {
          return {};
        }); // TransactWriteCommand succeeds on retry

      const result = await service.incrementCounter(requestId);

      expect(result).toBe(7);
      expect(mockDocClient.send).toHaveBeenCalledTimes(4);
    });

    it('should throw error when max value exceeded', async () => {
      const requestId = 'test-request-123';

      mockDocClient.send.mockImplementationOnce(async () => {
        return { Item: { value: 1_000_000_000, version: 1 } };
      });

      await expect(service.incrementCounter(requestId)).rejects.toThrow(
        'Value out of bounds: 1000000001'
      );
    });

    it('should fail after max retries', async () => {
      const requestId = 'test-request-123';

      // Always return same value and always fail with conflict
      for (let i = 0; i < 10; i++) {
        mockDocClient.send
          .mockImplementationOnce(() => Promise.resolve({ Item: { value: 5, version: 1 } }))
          .mockImplementationOnce(() =>
            Promise.reject(
              new ConditionalCheckFailedException({
                message: 'Conditional check failed',
                $metadata: {},
              })
            )
          );
      }

      await expect(service.incrementCounter(requestId)).rejects.toThrow(
        'Max retries exceeded for counter update'
      );
    });
  });

  describe('decrementCounter', () => {
    it('should decrement counter successfully', async () => {
      const requestId = 'test-request-456';

      mockDocClient.send
        .mockImplementationOnce(() => Promise.resolve({ Item: { value: 5, version: 1 } }))
        .mockImplementationOnce(() => Promise.resolve({}));

      const result = await service.decrementCounter(requestId);

      expect(result).toBe(4);
      expect(mockDocClient.send).toHaveBeenCalledWith(expect.any(TransactWriteCommand));
    });

    it('should throw error when value would go below zero', async () => {
      const requestId = 'test-request-456';

      mockDocClient.send.mockImplementationOnce(() => {
        return {
          Item: { value: 0, version: 1 },
        };
      });

      await expect(service.decrementCounter(requestId)).rejects.toThrow('Value out of bounds: -1');
    });

    it('should handle concurrent updates correctly', async () => {
      const requestId1 = 'test-request-1';

      // First decrement attempt
      mockDocClient.send
        .mockImplementationOnce(async () => ({ Item: { value: 10, version: 1 } }))
        .mockImplementationOnce(async () => {
          throw new ConditionalCheckFailedException({
            message: 'Conditional check failed',
            $metadata: {},
          });
        })
        // Retry shows value was already decremented by another request
        .mockImplementationOnce(async () => ({ Item: { value: 9, version: 2 } }))
        .mockImplementationOnce(async () => ({}));

      const result = await service.decrementCounter(requestId1);

      expect(result).toBe(8);
      expect(mockDocClient.send).toHaveBeenCalledTimes(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-conflict DynamoDB errors', async () => {
      const requestId = 'test-request-789';
      const dbError = new Error('DynamoDB Service Error');

      mockDocClient.send
        .mockImplementationOnce(async () => ({ Item: { value: 5, version: 1 } }))
        .mockImplementationOnce(async () => {
          throw dbError;
        });

      console.error = jest.fn();

      await expect(service.incrementCounter(requestId)).rejects.toThrow('DynamoDB Service Error');
    });

    it('should handle malformed DynamoDB responses', async () => {
      mockDocClient.send.mockImplementationOnce(async () => ({
        Item: { value: 'not-a-number', version: 1 },
      }));

      // This would cause issues in real usage
      const result = await service.getCounter();
      expect(result).toEqual({ value: 'not-a-number', version: 1 });
    });
  });
});
