import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBService } from '../services/dynamodb.service';
import { WebSocketService } from '../services/websocket.service';
import { validateRequest, createResponse } from '../utils/validation';
import { ApiError } from '../utils/errors';

const dynamoService = new DynamoDBService();
const wsService = new WebSocketService();

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Decrement request:', JSON.stringify(event.headers));

  try {
    // Validate request
    const { requestId, clientId } = validateRequest(event);

    // Perform decrement operation
    const newValue = await dynamoService.decrementCounter(requestId);

    // Broadcast update via WebSocket
    await wsService.broadcastUpdate({
      value: newValue,
      operation: 'decrement',
      clientId,
    });

    return createResponse(200, {
      success: true,
      value: newValue,
      requestId,
    });
  } catch (error: any) {
    console.error('Decrement error:', error);

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
        message: 'Counter value cannot go below zero',
      });
    }

    return createResponse(500, {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to decrement counter',
    });
  }
};
