import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBService } from '../services/dynamodb.service';
import { createResponse } from '../utils/validation';
import { createRequestLogger } from '../utils/logger';

const dynamoService = new DynamoDBService();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const logger = createRequestLogger(
    event.requestContext?.requestId || 'unknown',
    'get-handler'
  );
  
  logger.info('Get value request');

  try {
    // Get current counter value
    const counter = await dynamoService.getCounter();

    return createResponse(200, {
      success: true,
      value: counter.value,
      version: counter.version,
    });
  } catch (error: any) {
    logger.error({ error }, 'Get value error');

    return createResponse(500, {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve counter value',
    });
  }
};
