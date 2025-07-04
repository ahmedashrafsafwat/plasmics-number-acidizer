import { DynamoDBClient, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../utils/logger';

const MAX_RETRIES = 5;
const MAX_VALUE = 1_000_000_000;
const MIN_VALUE = 0;

export class DynamoDBService {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;
  private auditTableName: string;

  constructor() {
    const isLocal = process.env.ENVIRONMENT === 'local';

    const config: any = {
      region: process.env.AWS_REGION || 'eu-central-1',
      maxAttempts: 3,
    };

    // For local development, use local DynamoDB
    if (isLocal) {
      config.endpoint = 'http://dynamodb-local:8000';
      config.credentials = {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
      };
    }

    const client = new DynamoDBClient(config);

    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });

    this.tableName = process.env.COUNTER_TABLE_NAME || 'NumberAcidizer';
    this.auditTableName = process.env.AUDIT_TABLE_NAME || `${this.tableName}-audit`;
    
    const logger = createChildLogger({ service: 'dynamodb' });
    logger.info({
      counterTable: this.tableName,
      auditTable: this.auditTableName,
      isLocal
    }, 'DynamoDBService initialized');
  }

  async getCounter(): Promise<{ value: number; version: number }> {
    const response = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { id: 'global-counter' },
        ConsistentRead: true, // Strong consistency for ACID
      })
    );

    if (!response.Item) {
      // Initialize counter if it doesn't exist
      await this.initializeCounter();
      return { value: 0, version: 1 };
    }

    return {
      value: response.Item.value,
      version: response.Item.version,
    };
  }

  async incrementCounter(requestId: string): Promise<number> {
    return this.updateCounter(1, requestId);
  }

  async decrementCounter(requestId: string): Promise<number> {
    return this.updateCounter(-1, requestId);
  }

  private async updateCounter(delta: number, requestId: string): Promise<number> {
    let retries = 0;

    while (retries < MAX_RETRIES) {
      try {
        const current = await this.getCounter();
        const logger = createChildLogger({ service: 'dynamodb', method: 'updateCounter' });
        logger.debug({ current, delta, requestId }, 'Retrieved current counter for update');
        const newValue = current.value + delta;

        // Validate bounds
        if (newValue < MIN_VALUE || newValue > MAX_VALUE) {
          throw new Error(`Value out of bounds: ${newValue}`);
        }

        // Use transactional write for ACID compliance
        await this.docClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: this.tableName,
                  Key: { id: 'global-counter' },
                  UpdateExpression: 'SET #val = :newVal, #ver = :newVer, #updated = :timestamp',
                  ConditionExpression: '#ver = :currentVer',
                  ExpressionAttributeNames: {
                    '#val': 'value',
                    '#ver': 'version',
                    '#updated': 'lastUpdated',
                  },
                  ExpressionAttributeValues: {
                    ':newVal': newValue,
                    ':newVer': current.version + 1,
                    ':currentVer': current.version,
                    ':timestamp': new Date().toISOString(),
                  },
                },
              },
              {
                Put: {
                  TableName: this.auditTableName,
                  Item: {
                    id: uuidv4(),
                    requestId,
                    operation: delta > 0 ? 'increment' : 'decrement',
                    delta,
                    oldValue: current.value,
                    newValue,
                    timestamp: new Date().toISOString(),
                  },
                  ConditionExpression: 'attribute_not_exists(requestId)',
                },
              },
            ],
          })
        );

        return newValue;
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
          // Optimistic locking conflict - retry with exponential backoff
          retries++;
          await this.sleep(Math.pow(2, retries) * 100);
          continue;
        }
        throw error;
      }
    }

    throw new Error('Max retries exceeded for counter update');
  }

  private async initializeCounter(): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { id: 'global-counter' },
          UpdateExpression: 'SET #val = :zero, #ver = :one, #created = :timestamp',
          ConditionExpression: 'attribute_not_exists(id)',
          ExpressionAttributeNames: {
            '#val': 'value',
            '#ver': 'version',
            '#created': 'createdAt',
          },
          ExpressionAttributeValues: {
            ':zero': 0,
            ':one': 1,
            ':timestamp': new Date().toISOString(),
          },
        })
      );
    } catch (error) {
      // Ignore if already exists
      if (!(error instanceof ConditionalCheckFailedException)) {
        throw error;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
