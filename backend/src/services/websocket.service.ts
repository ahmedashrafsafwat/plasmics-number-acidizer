import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { logger, createChildLogger } from '../utils/logger';

export interface WebSocketMessage {
  value: number;
  operation: 'increment' | 'decrement';
  clientId?: string;
}

const stage = '/prod'; // Default to /prod if not set
export class WebSocketService {
  private apiClient?: ApiGatewayManagementApiClient;
  private docClient: DynamoDBDocumentClient;
  private connectionsTable: string;

  constructor() {
    const isLocal = process.env.ENVIRONMENT === 'local';
    let endpoint = process.env.WEBSOCKET_ENDPOINT;

    if (isLocal && !endpoint) {
      const port = process.env.PORT || 3001;
      endpoint = `http://localhost:${port}`;
      logger.info({ endpoint }, 'Local environment detected, using WebSocket endpoint');
    }

    if (!isLocal) {
      endpoint = process.env.WEBSOCKET_ENDPOINT + stage;
      logger.info({ endpoint }, 'Production environment detected, using WebSocket endpoint');
    }

    if (endpoint) {
      this.apiClient = new ApiGatewayManagementApiClient({
        endpoint,
        // For local dev with our mock, we don't need real AWS creds for this client.
        ...(isLocal && {
          credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' },
          region: 'eu-central-1',
        }),
      });
    }

    const dynamoConfig: any = {
      region: process.env.AWS_REGION || 'eu-central-1',
    };

    // For local development, use local DynamoDB
    if (isLocal) {
      dynamoConfig.endpoint = 'http://dynamodb-local:8000';
      dynamoConfig.credentials = {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
      };
    }

    const dynamoClient = new DynamoDBClient(dynamoConfig);
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
    this.connectionsTable = process.env.CONNECTIONS_TABLE_NAME || 'WebSocketConnections';
  }

  async broadcastUpdate(message: WebSocketMessage): Promise<void> {
    const serviceLogger = createChildLogger({ service: 'websocket', method: 'broadcastUpdate' });
    
    if (!this.apiClient) {
      serviceLogger.warn('WebSocket endpoint not configured, skipping broadcast');
      return;
    }

    try {
      // Get all active connections
      const response = await this.docClient.send(
        new ScanCommand({
          TableName: this.connectionsTable,
        })
      );

      if (!response.Items || response.Items.length === 0) {
        serviceLogger.info('No active WebSocket connections');
        return;
      }

      // Send update to all connections
      const sendPromises = response.Items.map(async (item) => {
        try {
          if (this.apiClient) {
            await this.apiClient.send(
              new PostToConnectionCommand({
                ConnectionId: item.connectionId,
                Data: Buffer.from(
                  JSON.stringify({
                    type: 'counter-update',
                    ...message,
                    timestamp: new Date().toISOString(),
                  })
                ),
              })
            );
          }
        } catch (error: any) {
          if (error.statusCode === 410) {
            // Connection no longer exists, remove it
            serviceLogger.info({ connectionId: item.connectionId }, 'Removing stale connection');
            await this.docClient.send(
              new DeleteCommand({
                TableName: this.connectionsTable,
                Key: { connectionId: item.connectionId },
              })
            );
          } else {
            serviceLogger.error({ connectionId: item.connectionId, error }, 'Error sending to connection');
          }
        }
      });

      await Promise.all(sendPromises);
      serviceLogger.info({ connectionCount: response.Items.length, message }, 'Broadcast sent to connections');
    } catch (error) {
      serviceLogger.error({ error }, 'Error broadcasting update');
    }
  }
}
