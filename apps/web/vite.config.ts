import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev, proxy API, uploads and Socket.IO to the local server so there is no CORS to configure.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/uploads': 'http://127.0.0.1:3000',
      '/socket.io': { target: 'http://127.0.0.1:3000', ws: true },
    },
  },
});
