import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  base: '/industrial-glb-exporter/', // TODO: 如果你的仓库名不是 industrial-glb-exporter，请修改这里
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  worker: {
    format: 'es'
  },
  build: {
    target: 'esnext'
  }
});