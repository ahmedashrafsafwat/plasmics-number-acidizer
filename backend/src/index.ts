import { createRequestLogger } from './utils/logger';

// Main router handler
export const handler = async (event: any, context: any, callback?: any): Promise<any> => {
  const requestLogger = createRequestLogger(
    event.requestContext?.requestId || context.awsRequestId,
    'main-router'
  );

  requestLogger.info({ 
    eventType: event.requestContext?.routeKey ? 'websocket' : 'http',
    routeKey: event.requestContext?.routeKey,
    httpMethod: event.httpMethod,
    path: event.path 
  }, 'Lambda invoked');
  
  // Check if this is a WebSocket event
  if (event.requestContext && event.requestContext.routeKey) {
    requestLogger.info({ routeKey: event.requestContext.routeKey }, 'Processing WebSocket event');

    const { connectHandler, disconnectHandler, defaultHandler } = await import(
      './handlers/websocket'
    );

    switch (event.requestContext.routeKey) {
      case '$connect':
        return connectHandler(event, context, callback);
      case '$disconnect':
        return disconnectHandler(event, context, callback);
      case '$default':
        return defaultHandler(event, context, callback);
      default:
        return { statusCode: 404, body: 'Route not found' };
    }
  }

  // HTTP API event
  requestLogger.info({ 
    method: event.httpMethod, 
    path: event.path,
    headers: event.headers 
  }, 'Processing HTTP request');

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

export { handler as incrementHandler } from './handlers/increment';
export { handler as decrementHandler } from './handlers/decrement';
export { handler as getHandler } from './handlers/get';
export { connectHandler, disconnectHandler, defaultHandler } from './handlers/websocket';
