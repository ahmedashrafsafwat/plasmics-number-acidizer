export interface Counter {
  id: string;
  value: number;
  version: number;
  lastUpdated: string;
  createdAt?: string;
}

export interface AuditLog {
  id: string;
  requestId: string;
  operation: 'increment' | 'decrement';
  delta: number;
  oldValue: number;
  newValue: number;
  timestamp: string;
  clientId?: string;
  ttl?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  requestId?: string;
}

export interface CounterResponse {
  value: number;
  version?: number;
  lastUpdated?: string;
}
