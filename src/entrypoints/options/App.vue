<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { getSettings, setSetting } from '@/lib/storage/settings';
import LanguageSelector from '@/components/LanguageSelector.vue';
import EngineSelector from '@/components/EngineSelector.vue';
import type { TranslationEngine } from '@/lib/translator/types';

const version = browser.runtime.getManifest().version;

const targetLang = ref('zh');
const engine = ref<TranslationEngine>('google');

const engines = [
  {
    type: 'google' as TranslationEngine,
    name: 'Google 翻译',
    badge: '免费',
    desc: '无需 API Key，直接使用。更多引擎（DeepL、Claude、OpenAI）即将推出。',
  },
];

onMounted(async () => {
  const settings = await getSettings();
  targetLang.value = settings.targetLang;
  engine.value = settings.translationEngine;
});

watch(targetLang, (val) => setSetting('targetLang', val));
watch(engine, (val) => setSetting('translationEngine', val));
</script>

<template>
  <div class="options">
    <h1>便捷翻译 · 设置</h1>
    <p class="version">版本 {{ version }}</p>

    <section>
      <h2>目标语言</h2>
      <LanguageSelector v-model="targetLang" />
    </section>

    <section>
      <h2>翻译引擎</h2>
      <EngineSelector v-model="engine" :engines="engines" />
    </section>

    <section>
      <h2>关于</h2>
      <p>便捷翻译（Bianyi Translate）是一个轻量、开源、零追踪的双语对照翻译浏览器扩展。</p>
      <p>
        <a href="https://github.com" target="_blank" rel="noopener">GitHub</a>
      </p>
    </section>
  </div>
</template>

<style scoped>
.options {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px;
  font-family: system-ui, sans-serif;
}
h1 {
  font-size: 20px;
  margin-bottom: 0;
}
.version {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}
section {
  margin-top: 20px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
section h2 {
  font-size: 14px;
  margin: 0 0 10px;
  color: #333;
}
</style>
