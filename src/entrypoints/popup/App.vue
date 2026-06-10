<script setup lang="ts">
const handleTranslate = () => {
  browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab?.id) {
      browser.tabs.sendMessage(tab.id, { type: 'TRANSLATE' });
    }
  });
};

const handleRestore = () => {
  browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab?.id) {
      browser.tabs.sendMessage(tab.id, { type: 'RESTORE' });
    }
  });
};
</script>

<template>
  <div class="popup">
    <h1>便捷翻译</h1>
    <p class="subtitle">轻量 · 开源 · 零追踪</p>
    <button class="btn btn-primary" @click="handleTranslate">翻译当前页</button>
    <button class="btn btn-secondary" @click="handleRestore">还原原文</button>
    <footer>
      <a href="#" @click.prevent="$router?.push('/options')">设置</a>
    </footer>
  </div>
</template>

<style scoped>
.popup {
  width: 240px;
  padding: 16px;
  font-family: system-ui, sans-serif;
  text-align: center;
}
h1 {
  font-size: 18px;
  margin: 0;
}
.subtitle {
  font-size: 12px;
  color: #888;
  margin: 4px 0 12px;
}
.btn {
  display: block;
  width: 100%;
  padding: 8px;
  margin: 6px 0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.btn-primary {
  background: #4f46e5;
  color: #fff;
}
.btn-primary:hover {
  background: #4338ca;
}
.btn-secondary {
  background: #e5e7eb;
  color: #333;
}
.btn-secondary:hover {
  background: #d1d5db;
}
footer {
  margin-top: 12px;
}
footer a {
  font-size: 12px;
  color: #4f46e5;
  text-decoration: none;
}
</style>
