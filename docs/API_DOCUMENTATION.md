# API Documentation

Comprehensive API documentation for the Number Acidizer application, should have generated it with swagger, but Chat-GPT came into my rescue on this one!

## Base URLs

| Environment    | REST API                                                    | WebSocket                                                      |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| **Production** | `https://wo9rryet3h.execute-api.eu-central-1.amazonaws.com` | `wss://b5nb3a6s90.execute-api.eu-central-1.amazonaws.com/prod` |
| **Local**      | `http://localhost:3001`                                     | `ws://localhost:3001`                                          |

## Authentication

The API currently doesn't require authentication but implements request tracking through headers:

- `X-Request-ID`: UUID for request idempotency
- `X-Client-ID`: UUID for client identification

## REST API Endpoints

### Get Counter Value

Retrieves the current counter value and version.

```http
GET /value
```

#### Response

```json
{
  "success": true,
  "value": 42,
  "version": 123
}
```

#### Response Schema

| Field     | Type    | Description                                |
| --------- | ------- | ------------------------------------------ |
| `success` | boolean | Always `true` for successful requests      |
| `value`   | number  | Current counter value (0 to 1,000,000,000) |
| `version` | number  | Version number for optimistic locking      |

#### Example

```bash
curl -X GET https://wo9rryet3h.execute-api.eu-central-1.amazonaws.com/value
```

### Increment Counter

Increments the counter by 1.

```http
POST /increment
```

#### Request Headers

| Header         | Required | Description                                      |
| -------------- | -------- | ------------------------------------------------ |
| `X-Request-ID` | No       | UUID for idempotency (auto-generated if missing) |
| `X-Client-ID`  | No       | UUID for client identification                   |
| `Content-Type` | Yes      | Must be `application/json`                       |

#### Response

```json
{
  "success": true,
  "value": 43,
  "requestId": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### Error Responses

**Value Out of Bounds (400)**

```json
{
  "success": false,
  "error": "VALUE_OUT_OF_BOUNDS",
  "message": "Counter value would exceed maximum limit"
}
```

**Internal Error (500)**

```json
{
  "success": false,
  "error": "INTERNAL_ERROR",
  "message": "Failed to increment counter"
}
```

#### Example

```bash
curl -X POST https://wo9rryet3h.execute-api.eu-central-1.amazonaws.com/increment \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: $(uuidgen)" \
  -H "X-Client-ID: $(uuidgen)"
```

### Decrement Counter

Decrements the counter by 1.

```http
POST /decrement
```

#### Request Headers

Same as increment endpoint.

#### Response

```json
{
  "success": true,
  "value": 41,
  "requestId": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### Error Responses

**Value Out of Bounds (400)**

```json
{
  "success": false,
  "error": "VALUE_OUT_OF_BOUNDS",
  "message": "Counter value cannot go below zero"
}
```

#### Example

```bash
curl -X POST https://wo9rryet3h.execute-api.eu-central-1.amazonaws.com/decrement \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: $(uuidgen)" \
  -H "X-Client-ID: $(uuidgen)"
```

## WebSocket API

The WebSocket API provides real-time updates when the counter value changes.

### Connection

```javascript
const ws = new WebSocket('wss://b5nb3a6s90.execute-api.eu-central-1.amazonaws.com/prod');

ws.onopen = () => {
  console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received update:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('WebSocket closed:', event.code, event.reason);
};
```

### Message Format

#### Counter Update Message

```json
{
  "type": "counter-update",
  "value": 42,
  "operation": "increment",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "clientId": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### Message Schema

| Field       | Type   | Description                                        |
| ----------- | ------ | -------------------------------------------------- |
| `type`      | string | Always `"counter-update"`                          |
| `value`     | number | New counter value                                  |
| `operation` | string | `"increment"` or `"decrement"`                     |
| `timestamp` | string | ISO 8601 timestamp                                 |
| `clientId`  | string | UUID of the client that made the change (optional) |

### Connection Management

#### Connection States

| State      | Code | Description                                 |
| ---------- | ---- | ------------------------------------------- |
| CONNECTING | 0    | Connection is being established             |
| OPEN       | 1    | Connection is open and ready to communicate |
| CLOSING    | 2    | Connection is being closed                  |
| CLOSED     | 3    | Connection is closed                        |

#### Error Codes

| Code | Description      | Action                       |
| ---- | ---------------- | ---------------------------- |
| 1000 | Normal closure   | Connection closed normally   |
| 1001 | Going away       | Endpoint is going away       |
| 1006 | Abnormal closure | Connection lost unexpectedly |
| 1011 | Server error     | Internal server error        |

### Client Implementation Example

```typescript
class CounterWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect() {
    this.ws = new WebSocket('wss://b5nb3a6s90.execute-api.eu-central-1.amazonaws.com/prod');

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'counter-update') {
          this.handleCounterUpdate(data);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code);
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private handleCounterUpdate(data: CounterUpdate) {
    // Update UI with new counter value
    console.log(`Counter ${data.operation}: ${data.value}`);
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
    }
  }
}
```

## Error Handling

### Error Response Format

All error responses follow a consistent format:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error description"
}
```

### Error Codes

| Code                  | HTTP Status | Description                                       |
| --------------------- | ----------- | ------------------------------------------------- |
| `VALIDATION_ERROR`    | 400         | Invalid request format or missing required fields |
| `VALUE_OUT_OF_BOUNDS` | 400         | Counter value would exceed limits (0-1B)          |
| `RATE_LIMIT_EXCEEDED` | 429         | Too many requests from client                     |
| `INTERNAL_ERROR`      | 500         | Server-side error                                 |
| `SERVICE_UNAVAILABLE` | 503         | Service temporarily unavailable                   |

### HTTP Status Codes

| Status | Description           |
| ------ | --------------------- |
| 200    | Success               |
| 400    | Bad Request           |
| 429    | Too Many Requests     |
| 500    | Internal Server Error |
| 503    | Service Unavailable   |

## Rate Limiting

### API Gateway Limits

| Endpoint     | Requests per Second | Burst Limit |
| ------------ | ------------------- | ----------- |
| `/value`     | 1000                | 2000        |
| `/increment` | 500                 | 1000        |
| `/decrement` | 500                 | 1000        |

### WebSocket Limits

| Metric                 | Limit                              |
| ---------------------- | ---------------------------------- |
| Concurrent connections | 1000 per API                       |
| Connection duration    | 2 hours max                        |
| Message rate           | 100 messages/second per connection |

## CORS Configuration

### Allowed Origins

- `https://d1nrvqnzqabwh4.cloudfront.net` (production)
- `http://localhost:3000` (development)

### Allowed Methods

- `GET`
- `POST`
- `OPTIONS`

### Allowed Headers

- `Content-Type`
- `X-Request-ID`
- `X-Client-ID`

## Testing the API

### Using curl

```bash
# Get current value
curl -X GET "https://wo9rryet3h.execute-api.eu-central-1.amazonaws.com/value"

# Increment counter
curl -X POST "https://wo9rryet3h.execute-api.eu-central-1.amazonaws.com/increment" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: $(uuidgen)"

# Decrement counter
curl -X POST "https://wo9rryet3h.execute-api.eu-central-1.amazonaws.com/decrement" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: $(uuidgen)"
```

### Using JavaScript

```javascript
// REST API client
class CounterAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async getValue() {
    const response = await fetch(`${this.baseUrl}/value`);
    return response.json();
  }

  async increment(requestId = crypto.randomUUID()) {
    const response = await fetch(`${this.baseUrl}/increment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
    });
    return response.json();
  }

  async decrement(requestId = crypto.randomUUID()) {
    const response = await fetch(`${this.baseUrl}/decrement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
    });
    return response.json();
  }
}

// Usage
const api = new CounterAPI('https://wo9rryet3h.execute-api.eu-central-1.amazonaws.com');

api.getValue().then(console.log);
api.increment().then(console.log);
```

### Using wscat (WebSocket testing)

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c wss://b5nb3a6s90.execute-api.eu-central-1.amazonaws.com/prod

# You should receive counter updates when other clients modify the counter
```

## Monitoring and Observability

### Request Tracing

Each request is assigned a unique trace ID for debugging:

```json
{
  "requestId": "123e4567-e89b-12d3-a456-426614174000",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "duration": 45,
  "statusCode": 200
}
```

### CloudWatch Metrics

| Metric                  | Description                   |
| ----------------------- | ----------------------------- |
| `RequestCount`          | Total number of API requests  |
| `ErrorRate`             | Percentage of failed requests |
| `Latency`               | Average response time         |
| `ConcurrentConnections` | Active WebSocket connections  |

### Logging

All API requests are logged with structured data:

```json
{
  "level": "info",
  "time": "2023-12-07T10:30:00.000Z",
  "requestId": "123e4567-e89b-12d3-a456-426614174000",
  "method": "POST",
  "path": "/increment",
  "statusCode": 200,
  "duration": 45,
  "userAgent": "Mozilla/5.0...",
  "sourceIp": "192.168.1.1"
}
```

## Performance Considerations

### Response Times

- **Target**: < 100ms for 95th percentile
- **Typical**: 20-50ms for counter operations
- **Maximum**: 5 seconds before timeout

### Throughput

- **Sustained**: 1000 requests/second
- **Burst**: 5000 requests/second
- **WebSocket**: 100 messages/second per connection

### Scalability

- Auto-scaling Lambda functions
- DynamoDB on-demand capacity
- CloudFront global edge caching

## SDKs and Libraries

### Official Client Libraries

While there are no official SDKs, the API is simple enough to integrate directly. Example implementations are provided above.

### Third-party Tools

- **Postman Collection**: Available in `/docs/postman/`
- **OpenAPI Specification**: Available in `/docs/openapi.yaml`
- **Insomnia Workspace**: Available in `/docs/insomnia/`

## Changelog

### Version 1.0.0 (Current)

- Initial API release
- REST endpoints for counter operations
- WebSocket support for real-time updates
- ACID compliance with DynamoDB transactions

### Planned Features

- Authentication and authorization
- Rate limiting per user
- Batch operations
- Historical data endpoints
- API versioning
