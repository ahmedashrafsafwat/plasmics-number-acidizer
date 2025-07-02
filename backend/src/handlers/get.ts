import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBService } from '../services/dynamodb.service';
import { createResponse } from '../utils/validation';

const dynamoService = new DynamoDBService();

export const handler = async (_: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Get value request');

  try {
    // Get current counter value
    const counter = await dynamoService.getCounter();

    return createResponse(200, {
      success: true,
      value: counter.value,
      version: counter.version,
    });
  } catch (error: any) {
    console.error('Get value error:', error);

    return createResponse(500, {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve counter value',
    });
  }
};
