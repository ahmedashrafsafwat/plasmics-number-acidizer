import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBService } from '../services/dynamodb.service';
import { WebSocketService } from '../services/websocket.service';
import { validateRequest, createResponse } from '../utils/validation';
import { ApiError } from '../utils/errors';

const dynamoService = new DynamoDBService();
const wsService = new WebSocketService();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Increment request:', JSON.stringify(event.headers));

  try {
    // Validate request
    const { requestId, clientId } = validateRequest(event);

    // Perform increment operation
    const newValue = await dynamoService.incrementCounter(requestId);

    console.log('New counter value:', newValue);

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
    console.error('Increment error:', error);

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
