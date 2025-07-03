import { Server } from 'http';
import { AddressInfo } from 'net';
import axios, { AxiosInstance } from 'axios';
import app from '../../local/server'; // Adjust path as needed

export class TestServer {
  private server: Server | null = null;
  private baseURL: string = '';
  public api: AxiosInstance | null = null;

  async start(): Promise<string> {
    // Dynamically import to get fresh instance

    return new Promise((resolve, reject) => {
      this.server = app.listen(0, (err?: Error) => {
        if (err) {
          reject(err);
          return;
        }

        const port = (this.server!.address() as AddressInfo).port;
        this.baseURL = `http://localhost:${port}`;

        this.api = axios.create({
          baseURL: this.baseURL,
          headers: {
            'Content-Type': 'application/json',
          },
          validateStatus: () => true,
        });

        setTimeout(() => resolve(this.baseURL), 100);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = null;
          this.api = null;
          resolve();
        });
      });
    }
  }

  getBaseURL(): string {
    return this.baseURL;
  }
}

// Factory function instead of singleton
export function createTestServer(): TestServer {
  return new TestServer();
}
