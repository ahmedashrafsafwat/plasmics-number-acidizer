import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Re-export all handlers
export { handler as incrementHandler } from './handlers/increment';
export { handler as decrementHandler } from './handlers/decrement';
export { handler as getHandler } from './handlers/get';
export { connectHandler, disconnectHandler, defaultHandler } from './handlers/websocket';

// Main router handler
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Request:', event.httpMethod, event.path);

  // Route based on path
  if (event.path === '/increment' && event.httpMethod === 'POST') {
    const incrementHandler = await import('./handlers/increment');
    return incrementHandler.handler(event);
  }

  if (event.path === '/decrement' && event.httpMethod === 'POST') {
    const decrementHandler = await import('./handlers/decrement');
    return decrementHandler.handler(event);
  }

  if (event.path === '/value' && event.httpMethod === 'GET') {
    const getHandler = await import('./handlers/get');
    return getHandler.handler(event);
  }

  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Request-ID,X-Client-ID',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      },
      body: '',
    };
  }

  return {
    statusCode: 404,
    body: JSON.stringify({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
    }),
  };
};
