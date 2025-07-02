import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

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

  console.log(`WebSocket connect: ${connectionId}`);

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

    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    console.error('Connect error:', error);
    return { statusCode: 500, body: 'Failed to connect' };
  }
};

export const disconnectHandler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;

  console.log(`WebSocket disconnect: ${connectionId}`);

  try {
    await docClient.send(
      new DeleteCommand({
        TableName: connectionsTable,
        Key: { connectionId },
      })
    );

    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    console.error('Disconnect error:', error);
    return { statusCode: 500, body: 'Failed to disconnect' };
  }
};

export const defaultHandler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  console.log('WebSocket default message:', event.body);
  return { statusCode: 200, body: 'Message received' };
};
