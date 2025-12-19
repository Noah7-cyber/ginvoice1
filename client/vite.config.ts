import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load only VITE_ prefixed env variables
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react()],

    server: {
      port: 3000,
      host: true,
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
