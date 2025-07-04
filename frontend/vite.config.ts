import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true, // Listen on all addresses
    open: false, // Don't try to open browser in Docker
  },
  build: {
    outDir: 'build',
    sourcemap: true,
  },
  define: {
    'process.env.REACT_APP_API_URL': JSON.stringify(process.env.REACT_APP_API_URL),
    'process.env.REACT_APP_WS_URL': JSON.stringify(process.env.REACT_APP_WS_URL),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
});
