import { v4 as uuidv4 } from 'uuid';

export interface ApiResponse<T = any> {
  success: boolean;
  value?: number;
  data?: T;
  error?: string;
  message?: string;
  requestId?: string;
}

export class ApiService {
  private baseUrl: string;
  private clientId: string;

  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    this.clientId = this.getOrCreateClientId();
  }

  private getOrCreateClientId(): string {
    const stored = sessionStorage.getItem('clientId');
    if (stored) return stored;
    
    const newId = uuidv4();
    sessionStorage.setItem('clientId', newId);
    return newId;
  }

  getClientId(): string {
    return this.clientId;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const requestId = uuidv4();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Client-ID': this.clientId,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    const text = await response.text();
    console.log('API Response:', text);
    
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse response:', e);
      throw new Error('Invalid JSON response');
    }
  }

  async getValue(): Promise<ApiResponse> {
    return this.request<ApiResponse>('/value', {
      method: 'GET',
    });
  }

  async increment(): Promise<ApiResponse> {
    return this.request<ApiResponse>('/increment', {
      method: 'POST',
    });
  }

  async decrement(): Promise<ApiResponse> {
    return this.request<ApiResponse>('/decrement', {
      method: 'POST',
    });
  }
}
