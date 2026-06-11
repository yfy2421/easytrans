<script setup lang="ts">
import type { TranslationEngine } from '@/lib/translator/types';

interface EngineInfo {
  type: TranslationEngine;
  name: string;
  badge: string;
  desc: string;
  disabled?: boolean;
}

defineProps<{
  engines: EngineInfo[];
  modelValue: TranslationEngine;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: TranslationEngine];
}>();
</script>

<template>
  <div class="engine-list">
    <div
      v-for="eng in engines"
      :key="eng.type"
      class="engine-item"
      :class="{
        'engine-item--active': eng.type === modelValue,
        'engine-item--disabled': eng.disabled,
      }"
      @click="!eng.disabled && emit('update:modelValue', eng.type)"
    >
      <span class="engine-name">{{ eng.name }}</span>
      <span class="engine-badge">{{ eng.badge }}</span>
      <p class="engine-desc">{{ eng.desc }}</p>
    </div>
    <p v-if="engines.length === 0" class="engine-empty">暂无可用翻译引擎</p>
  </div>
</template>

<style scoped>
.engine-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.engine-item {
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  transition: border-color 0.15s;
}
.engine-item:hover {
  border-color: #a5b4fc;
}
.engine-item--active {
  border-color: #4f46e5;
  background: #f5f3ff;
}
.engine-item--disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
.engine-empty {
  font-size: 12px;
  color: #999;
  text-align: center;
  padding: 12px;
}
</style>
