import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { createRequestLogger } from '../utils/logger';

// Create DynamoDB client with proper configuration for local development
const createDynamoDBClient = () => {
  const isLocal = process.env.ENVIRONMENT === 'local';

  const config: any = {
    region: process.env.AWS_REGION || 'eu-central-1',
  };

  if (isLocal) {
    config.endpoint = 'http://dynamodb-local:8000';
    config.credentials = {
      accessKeyId: 'dummy',
      secretAccessKey: 'dummy',
    };
  }

  return new DynamoDBClient(config);
};

const docClient = DynamoDBDocumentClient.from(createDynamoDBClient());
const connectionsTable = process.env.CONNECTIONS_TABLE_NAME || 'WebSocketConnections';

export const connectHandler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const logger = createRequestLogger(event.requestContext.requestId, 'websocket-connect');

  logger.info({ connectionId }, 'WebSocket connection initiated');

  try {
    await docClient.send(
      new PutCommand({
        TableName: connectionsTable,
        Item: {
          connectionId,
          timestamp: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 3600, // 1 hour TTL
        },
      })
    );

    logger.info({ connectionId }, 'WebSocket connection stored successfully');
    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    logger.error({ connectionId, error }, 'Failed to store WebSocket connection');
    return { statusCode: 500, body: 'Failed to connect' };
  }
};

export const disconnectHandler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const logger = createRequestLogger(event.requestContext.requestId, 'websocket-disconnect');

  logger.info({ connectionId }, 'WebSocket disconnection initiated');

  try {
    await docClient.send(
      new DeleteCommand({
        TableName: connectionsTable,
        Key: { connectionId },
      })
    );

    logger.info({ connectionId }, 'WebSocket connection removed successfully');
    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    logger.error({ connectionId, error }, 'Failed to remove WebSocket connection');
    return { statusCode: 500, body: 'Failed to disconnect' };
  }
};

export const defaultHandler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const logger = createRequestLogger(event.requestContext.requestId, 'websocket-default');
  
  logger.info({ 
    connectionId: event.requestContext.connectionId,
    messageBody: event.body 
  }, 'WebSocket message received');
  
  return { statusCode: 200, body: 'Message received' };
};
