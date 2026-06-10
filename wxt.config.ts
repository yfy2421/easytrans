import { defineConfig } from 'wxt';
import vue from '@vitejs/plugin-vue';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  vite: () => ({
    plugins: [vue()],
  }),
  manifest: {
    name: '便捷翻译',
    description: '轻量、开源、零追踪的双语对照翻译浏览器扩展',
    permissions: ['storage'],
    host_permissions: [
      'https://translate.googleapis.com/*',
      'https://api-free.deepl.com/*',
      'https://api.deepl.com/*',
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'http://localhost:11434/*',
    ],
  },
});
