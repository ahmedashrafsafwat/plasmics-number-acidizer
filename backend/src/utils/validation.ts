import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

export function validateRequest(event: APIGatewayProxyEvent): { requestId: string; clientId: string } {
  const requestId = event.headers['x-request-id'] || event.headers['X-Request-ID'] || uuidv4();
  const clientId = event.headers['x-client-id'] || event.headers['X-Client-ID'] || 'anonymous';

  // Validate request ID format (UUID v4)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(requestId)) {
    throw new Error('Invalid request ID format');
  }

  // Basic sanitization for clientId
  const sanitizedClientId = clientId.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 64);

  return { requestId, clientId: sanitizedClientId };
}

export function createResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Request-ID,X-Client-ID',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

export function parseBody(event: APIGatewayProxyEvent): any {
  if (!event.body) {
    return {};
  }

  try {
    return JSON.parse(event.body);
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
}
