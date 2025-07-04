import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBService } from '../services/dynamodb.service';
import { WebSocketService } from '../services/websocket.service';
import { validateRequest, createResponse } from '../utils/validation';
import { ApiError } from '../utils/errors';
import { createRequestLogger } from '../utils/logger';

const dynamoService = new DynamoDBService();
const wsService = new WebSocketService();

/**
 * In real life application I would highly suggest to have a seprate controller and service layer, maybe even a repository layer for data access.
 * This would help to keep the code clean and maintainable.
 * However, for the sake of simplicity and time constraints, I am keeping everything in one file.
 */
// Handler for incrementing the counter
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const logger = createRequestLogger(
    event.requestContext?.requestId || 'unknown',
    'increment-handler'
  );

  logger.info({ headers: event.headers }, 'Increment request');

  try {
    // Validate request
    const { requestId, clientId } = validateRequest(event);

    // Perform increment operation
    const newValue = await dynamoService.incrementCounter(requestId);

    logger.info({ value: newValue }, 'Counter incremented successfully');

    // Broadcast update via WebSocket
    await wsService.broadcastUpdate({
      value: newValue,
      operation: 'increment',
      clientId,
    });

    return createResponse(200, {
      success: true,
      value: newValue,
      requestId,
    });
  } catch (error: any) {
    logger.error({ error }, 'Increment error');

    if (error instanceof ApiError) {
      return createResponse(error.statusCode, {
        success: false,
        error: error.code,
        message: error.message,
      });
    }

    if (error.message?.includes('out of bounds')) {
      return createResponse(400, {
        success: false,
        error: 'VALUE_OUT_OF_BOUNDS',
        message: 'Counter value would exceed maximum limit',
      });
    }

    return createResponse(500, {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to increment counter',
    });
  }
};
