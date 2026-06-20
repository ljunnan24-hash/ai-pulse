import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
        // IMPORTANT: do NOT proxy '/admin' because '/admin/*' is also the frontend route namespace.
        // Only proxy actual backend admin API endpoints.
        '/admin/auth': { target: 'http://127.0.0.1:8000', changeOrigin: true },
        '/admin/metrics': { target: 'http://127.0.0.1:8000', changeOrigin: true },
        '/admin/subscribers': { target: 'http://127.0.0.1:8000', changeOrigin: true },
        // 运营统计 / 反馈 API 已迁至 /api/admin/*，由 /api 代理统一转发，勿再单独代理 /admin/analytics
        '/manage': { target: 'http://127.0.0.1:8000', changeOrigin: true },
        '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      },
    },
  };
});
