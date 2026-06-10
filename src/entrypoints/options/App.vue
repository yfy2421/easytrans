<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

const version = browser.runtime.getManifest().version;

interface LangOption {
  value: string;
  label: string;
}

const LANGUAGES: LangOption[] = [
  { value: 'zh', label: '中文（简体）' },
  { value: 'zh-TW', label: '中文（繁体）' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'ru', label: 'Русский' },
];

const targetLang = ref('zh');

onMounted(async () => {
  const data = await browser.storage.local.get('targetLang');
  if (data.targetLang) {
    targetLang.value = data.targetLang as string;
  }
});

watch(targetLang, (val) => {
  browser.storage.local.set({ targetLang: val });
});
</script>

<template>
  <div class="options">
    <h1>便捷翻译 · 设置</h1>
    <p class="version">版本 {{ version }}</p>

    <section>
      <h2>目标语言</h2>
      <label for="target-lang">翻译为：</label>
      <select id="target-lang" v-model="targetLang">
        <option v-for="lang in LANGUAGES" :key="lang.value" :value="lang.value">
          {{ lang.label }}
        </option>
      </select>
    </section>

    <section>
      <h2>翻译引擎</h2>
      <div class="engine-list">
        <div class="engine-item engine-item--active">
          <span class="engine-name">Google 翻译</span>
          <span class="engine-badge">免费</span>
          <p class="engine-desc">无需 API Key，直接使用。更多引擎（DeepL、Claude、OpenAI）即将推出。</p>
        </div>
      </div>
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
label {
  font-size: 13px;
  margin-right: 8px;
}
select {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
}
.engine-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.engine-item {
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.engine-item--active {
  border-color: #4f46e5;
  background: #f5f3ff;
}
.engine-name {
  font-weight: 600;
  font-size: 14px;
}
.engine-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #10b981;
  color: #fff;
}
.engine-desc {
  width: 100%;
  margin: 4px 0 0;
  font-size: 12px;
  color: #888;
}
</style>
