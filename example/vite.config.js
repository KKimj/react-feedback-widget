import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      include: [
        /\.jsx?$/,
      ],
    }),
  ],
  resolve: {
    alias: {
      'react-visual-feedback': path.resolve(__dirname, '../src'),
    },
  },
  optimizeDeps: {
    include: ['styled-components', 'lucide-react'],
  },
  server: {
    port: 8080,
    open: false,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api/feedback': 'http://localhost:3010',
    },
    fs: {
      allow: ['..'],
    },
  },
});
