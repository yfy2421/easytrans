<script setup lang="ts">
import { computed } from 'vue';

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

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const selected = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val),
});
</script>

<template>
  <label for="target-lang">翻译为：</label>
  <select id="target-lang" v-model="selected">
    <option v-for="lang in LANGUAGES" :key="lang.value" :value="lang.value">
      {{ lang.label }}
    </option>
  </select>
</template>

<style scoped>
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
</style>
