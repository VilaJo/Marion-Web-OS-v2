import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '127.0.0.1',
      },
      plugins: [react()],
      build: {
        outDir: '.dist',
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return;
              if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
              if (id.includes('@tanstack/react-query')) return 'vendor-query';
              if (id.includes('@dnd-kit')) return 'vendor-dnd';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('dompurify')) return 'vendor-sanitize';
            },
          },
        },
      },
      define: {
        // 'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY), // REMOVED FOR SECURITY
      },
      resolve: {
        dedupe: ['react', 'react-dom'],
        alias: {
          '@': path.resolve(__dirname, '.'),
          react: path.resolve(__dirname, 'node_modules/react'),
          'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        }
      },
      test: {
        globals: true,
        environment: 'jsdom',
      }
    };
});
