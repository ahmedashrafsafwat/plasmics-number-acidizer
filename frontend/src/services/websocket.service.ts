import { ApiService } from './api.service';

export interface WebSocketMessage {
  type: 'counter-update';
  value: number;
  operation: 'increment' | 'decrement';
  clientId?: string;
  timestamp: string;
}

// Represents the websocket stage, we need that in production
const stage = '/prod';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private listeners: ((data: WebSocketMessage) => void)[] = [];
  private apiService: ApiService;
  private wsUrl: string;

  constructor() {
    this.apiService = new ApiService();
    // WebSocket URL is now injected during build time via CI/CD pipeline from Terraform outputs
    // This follows best practices for production applications
    this.wsUrl = process.env.REACT_APP_WS_URL + stage || 'ws://localhost:3001';
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      };

      this.ws.onmessage = async (event) => {
        try {
          let data: any;

          // Handle both Blob and string data
          if (event.data instanceof Blob) {
            const text = await event.data.text();
            data = JSON.parse(text);
          } else {
            data = JSON.parse(event.data);
          }

          // Notify all listeners
          this.listeners.forEach((listener) => listener(data));
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error event:', error);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected');
        console.log('Close reason:', event.reason);
        console.log('Was clean close:', event.wasClean);
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      this.connect();
    }, 5000); // Reconnect after 5 seconds
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onUpdate(callback: (data: WebSocketMessage) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }
}
