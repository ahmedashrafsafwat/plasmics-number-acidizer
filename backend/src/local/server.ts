import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';
import { handler as getHandler } from '../handlers/get';
import { handler as incrementHandler } from '../handlers/increment';
import { handler as decrementHandler } from '../handlers/decrement';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyWebsocketHandlerV2,
  Context,
} from 'aws-lambda';

const app = express();
const port = process.env.PORT || 3001;

// --- Environment Setup for Local Development ---
// Set environment variables to match local configuration.
// This ensures all services (DynamoDB, WebSocket) use the correct local resources.
process.env.ENVIRONMENT = 'local';
const TableNames = {
  NumberAcidizer: 'NumberAcidizer-local',
  Audit: 'NumberAcidizer-local-audit',
  WebSocketConnections: 'WebSocketConnections-local',
};
process.env.CONNECTIONS_TABLE_NAME = TableNames.WebSocketConnections;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_, res: Response) => {
  res.json({ status: 'healthy' });
});

// Create a mock Lambda context for local execution
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'local-lambda',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:eu-central-1:123456789012:function:local-lambda',
  memoryLimitInMB: '512',
  awsRequestId: `local-req-${Date.now()}`,
  logGroupName: '/aws/lambda/local-lambda',
  logStreamName: '2023/10/27/[$LATEST]abcdef123456',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

// Lambda handler wrapper
const wrapLambdaHandler = (
  handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>
) => {
  return async (req: Request, res: Response) => {
    const event: APIGatewayProxyEvent = {
      httpMethod: req.method,
      path: req.path,
      headers: req.headers as any,
      body: JSON.stringify(req.body),
      queryStringParameters: req.query as any,
      resource: req.path,
      requestContext: {
        accountId: 'local-account',
        apiId: 'local-api',
        httpMethod: req.method,
        path: req.path,
        authorizer: null,
        protocol: 'HTTP/1.1',
        stage: '$default',
        requestId: (req.headers['x-request-id'] as string) || `local-req-${Date.now()}`,
        requestTimeEpoch: Date.now(),
        resourceId: 'local-resource',
        resourcePath: req.path,
        identity: {
          sourceIp: req.ip || '127.0.0.1',
          apiKey: null,
          apiKeyId: null,
          userArn: null,
          userAgent: req.headers['user-agent'] || 'unknown',
          user: null,
          caller: null,
          cognitoAuthenticationProvider: null,
          cognitoAuthenticationType: null,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          accountId: null,
          accessKey: null,
          principalOrgId: null,
        } as any,
      },
      isBase64Encoded: false,
      pathParameters: null,
      stageVariables: null,
      multiValueHeaders: {},
      multiValueQueryStringParameters: null,
    };

    try {
      const result = await handler(event, mockContext);
      res.status(result.statusCode).set(result.headers).send(result.body);
    } catch (error) {
      console.error('Handler error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Import all handlers
import {
  connectHandler,
  disconnectHandler,
  defaultHandler as wsDefaultHandler,
} from '../handlers/websocket';

// Routes
app.get('/value', wrapLambdaHandler(getHandler));
app.post('/increment', wrapLambdaHandler(incrementHandler));
app.post('/decrement', wrapLambdaHandler(decrementHandler));

// --- WebSocket Local Simulation ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const connections = new Map<string, WebSocket>();

// Helper to invoke WebSocket Lambda handlers with a mock event
const invokeWebSocketHandler = async (
  handler: APIGatewayProxyWebsocketHandlerV2,
  routeKey: string,
  connectionId: string,
  body?: string
) => {
  console.log(`Invoking WebSocket handler for ${routeKey} on connection ${connectionId}`);
  const now = new Date();
  const eventType =
    routeKey === '$connect' ? 'CONNECT' : routeKey === '$disconnect' ? 'DISCONNECT' : 'MESSAGE';
  const requestId = `local-ws-req-${now.getTime()}`;

  const event: APIGatewayProxyWebsocketEventV2 = {
    isBase64Encoded: false,
    body: body, // This is now correctly typed as string | undefined
    requestContext: {
      routeKey,
      connectionId,
      eventType,
      domainName: 'localhost:3001',
      apiId: 'local-api',
      connectedAt: now.getTime(),
      requestTimeEpoch: now.getTime(),
      requestTime: now.toISOString(),
      extendedRequestId: requestId,
      requestId: requestId,
      stage: '$default',
      messageId: eventType === 'MESSAGE' ? requestId : '',
      messageDirection: 'IN' as const,
    },
  };

  try {
    const result = await handler(event, mockContext, () => {});
    // Type guard to ensure result is an object with properties, not a string or void.
    if (result && typeof result === 'object' && result.statusCode && result.statusCode >= 400) {
      console.error(
        `WebSocket handler for ${routeKey} failed with status ${result.statusCode}:`,
        result.body
      );
    }
  } catch (error) {
    console.error(`Error invoking WebSocket handler for ${routeKey}:`, error);
  }
};

// This now integrates with the actual application logic by invoking the handlers
wss.on('connection', (ws: WebSocket, _: http.IncomingMessage) => {
  // Generate a simple connectionId for local development
  const connectionId = `local-ws-${Date.now()}-${Math.random()}`;
  connections.set(connectionId, ws);

  // Invoke the connect handler to register the connection in DynamoDB
  invokeWebSocketHandler(connectHandler, '$connect', connectionId);

  ws.on('close', () => {
    connections.delete(connectionId);
    // Invoke the disconnect handler to remove the connection from DynamoDB
    invokeWebSocketHandler(disconnectHandler, '$disconnect', connectionId);
  });

  ws.on('message', (message: Buffer) => {
    // Invoke the default handler for incoming messages
    invokeWebSocketHandler(wsDefaultHandler, '$default', connectionId, message.toString());
  });
});

// Mock for ApiGatewayManagementApiClient's PostToConnectionCommand.
// The AWS SDK will POST to `/@connections/{connectionId}`.
app.post('/@connections/:connectionId', (req: Request, res: Response) => {
  const { connectionId } = req.params;
  const ws = connections.get(connectionId);

  if (ws) {
    // The AWS SDK sends the body as a buffer. We need to read the raw request body
    // and forward it to the WebSocket client using ws.send().
    // We can't use req.pipe() as ws.WebSocket is not a standard WritableStream.
    const chunks: any[] = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      ws.send(body);
      res.status(200).send('Message sent.');
    });
    req.on('error', (err) => {
      console.error('Error reading request stream for WebSocket broadcast:', err);
      res.status(500).send('Error processing request');
    });
  } else {
    // API Gateway returns 410 Gone for stale connections.
    res.status(410).send('Connection not found.');
  }
});

async function initializeTable(
  client: DynamoDBClient,
  TableName: string,
  hashKey: string,
  gsiKey?: string
) {
  try {
    await client.send(new DescribeTableCommand({ TableName }));
    console.log(`Table ${TableName} already exists`);
  } catch (err: any) {
    if (err.name === 'ResourceNotFoundException') {
      console.log(`Creating table ${TableName}...`);

      const attributeDefinitions = [{ AttributeName: hashKey, AttributeType: 'S' as const }];

      if (gsiKey) {
        attributeDefinitions.push({ AttributeName: gsiKey, AttributeType: 'S' as const });
      }

      const params: any = {
        TableName,
        AttributeDefinitions: attributeDefinitions,
        KeySchema: [{ AttributeName: hashKey, KeyType: 'HASH' as const }],
        ProvisionedThroughput: {
          ReadCapacityUnits: 1,
          WriteCapacityUnits: 1,
        },
      };

      if (gsiKey) {
        params.GlobalSecondaryIndexes = [
          {
            IndexName: `${gsiKey}-index`,
            KeySchema: [{ AttributeName: gsiKey, KeyType: 'HASH' as const }],
            Projection: { ProjectionType: 'ALL' as const },
            ProvisionedThroughput: {
              ReadCapacityUnits: 1,
              WriteCapacityUnits: 1,
            },
          },
        ];
      }

      await client.send(new CreateTableCommand(params));
      console.log(`Table ${TableName} created.`);
    } else {
      throw err;
    }
  }
}

// Start server
server.listen(port, async () => {
  console.log(`Local development server running on port ${port}`);
  console.log(`Local WebSocket server running on ws://localhost:${port}`);

  // Initialize DynamoDB tables
  const client = new DynamoDBClient({
    endpoint: 'http://dynamodb-local:8000',
    region: 'eu-central-1',
    credentials: {
      accessKeyId: 'dummy',
      secretAccessKey: 'dummy',
    },
  });

  // Set table names for the HTTP handlers
  process.env.COUNTER_TABLE_NAME = TableNames.NumberAcidizer;
  process.env.AUDIT_TABLE_NAME = TableNames.Audit;
  await waitForDynamoDBReady(client);

  console.log('Initializing local DynamoDB tables...');
  // not ideal way to initialize tables, but works for local dev and for the limited scope of this task
  await initializeTable(client, TableNames.NumberAcidizer, 'id');
  await initializeTable(client, TableNames.Audit, 'id', 'requestId'); // Add GSI for requestId
  await initializeTable(client, TableNames.WebSocketConnections, 'connectionId');
});

async function waitForDynamoDBReady(client: DynamoDBClient, retries = 10, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await client.send(new ListTablesCommand({}));
      console.log('✅ DynamoDB is ready');
      return;
    } catch (e: any) {
      console.log(`⏳ Waiting for DynamoDB... (${i + 1}/${retries})`, e.message || e);
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
  throw new Error('❌ DynamoDB did not become ready in time');
}

export default app;
