// Main router handler
export const handler = async (event: any, context: any, callback?: any): Promise<any> => {
  console.log('🚀 Lambda invoked!');
  console.log('📋 Event type check:', {
    hasRequestContext: !!event.requestContext,
    routeKey: event.requestContext?.routeKey,
    httpMethod: event.httpMethod,
    path: event.path,
    eventKeys: Object.keys(event)
  });
  
  // Check if this is a WebSocket event
  if (event.requestContext && event.requestContext.routeKey) {
    console.log('WebSocket event:', event.requestContext.routeKey);

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
  console.log('HTTP Request:', event.httpMethod, event.path);

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
