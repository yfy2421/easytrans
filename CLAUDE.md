# CLAUDE.md — 便捷翻译

本文件为 Claude Code 在此项目中的工作提供指引。

## 项目概述

便捷翻译（Bianyi Translate）是一个轻量、开源、零追踪的双语对照翻译浏览器扩展。

- **定位**：隐私优先的沉浸式翻译开源替代品
- **核心理念**：零追踪、直连 API（默认）、完全开源，可选 API 代理（按量计费，给不想折腾 Key 的用户）
- **技术栈**：WXT + TypeScript + Vue 3 + Vite + Node.js/TS 后端（API 代理服务）
- **包管理**：npm（pnpm 不可用时使用 npm）
- **目标平台**：Chrome 88+ / Edge 88+ / Firefox 109+ → Safari（后续）。不兼容 IE、旧版国产浏览器（Manifest V3 硬性约束）

## 项目结构

```
便捷翻译/
├── README.md               # 项目说明
├── CLAUDE.md               # 本文件
├── docs/
│   ├── ARCHITECTURE.md      # 架构设计文档（必读）
│   └── PLAN.md              # 实施计划与路线图（必读）
├── src/
│   ├── entrypoints/         # WXT 入口点
│   │   ├── popup/           # 弹出面板
│   │   ├── options/         # 设置页
│   │   ├── content.ts       # Content Script
│   │   └── background.ts    # Background Worker
│   ├── components/          # Vue 3 组件
│   ├── lib/                 # 核心逻辑
│   │   ├── translator/      # 翻译引擎适配层
│   │   │   ├── types.ts     # 统一接口定义
│   │   │   ├── google.ts    # Google 翻译
│   │   │   ├── deepl.ts     # DeepL 翻译
│   │   │   ├── openai.ts    # OpenAI 翻译
│   │   │   ├── claude.ts    # Claude 翻译
│   │   │   ├── ollama.ts    # Ollama 本地翻译
│   │   │   └── dispatcher.ts # 引擎调度器
│   │   ├── dom/             # DOM 操作
│   │   │   ├── extractor.ts # 文本提取器
│   │   │   ├── injector.ts  # 译文注入器
│   │   │   └── observer.ts  # DOM 变化监听
│   │   ├── storage/         # 存储层
│   │   │   ├── cache.ts     # 翻译缓存（IndexedDB）
│   │   │   └── settings.ts  # 设置存储
│   │   └── rules/           # 规则引擎
│   │       ├── engine.ts    # 匹配引擎
│   │       └── builtin.ts   # 内置规则
│   ├── styles/              # 全局样式
│   └── assets/              # 图标等资源
├── public/
│   └── icons/               # 扩展图标（16/48/128px）
├── tests/
│   ├── unit/                # Vitest 单元测试
│   └── e2e/                 # Playwright E2E
├── wxt.config.ts            # WXT 配置
├── tsconfig.json
└── package.json
```

## 开发命令

```bash
# 包管理（pnpm 优先，不可用时用 npm）
npm install          # 安装依赖
npm run dev          # 开发模式（Chrome，HMR 热重载）
npm run dev:firefox  # 开发模式（Firefox）
npm run build        # 构建 Chrome/Edge（产出 .output/chrome-mv3/）
npm run build:firefox # 构建 Firefox（产出 .output/firefox-mv2/）
npm test             # 运行单元测试（Vitest）
npm run test:e2e     # 运行 E2E 测试（Playwright）
npm run lint         # ESLint
npm run typecheck    # TypeScript 类型检查

# 加载扩展：Chrome → chrome://extensions/ → 开发者模式 → 加载 .output/chrome-mv3/
```

## 开发规范

### TDD 流程（强制）

TDD 三步骤：

1. **红**：先写失败测试
2. **绿**：最少代码让测试通过
3. **重构**：改进代码结构

### 文件与函数限制

- 单文件 ≤ 300 行
- 单函数 ≤ 30 行
- 超过则拆分

### 提交格式

```
[红] 添加 xxx 测试用例
[绿] 实现 xxx 功能
[重构] 优化 xxx 代码结构
```

### 代码风格

- TypeScript strict 模式
- Vue 3 Composition API + `<script setup>`
- 命名：文件/文件夹 kebab-case，函数 camelCase，类型 PascalCase
- 翻译适配器统一实现 `ITranslationAdapter` 接口
- 错误处理：适配器内部不吞异常，统一由 dispatcher 处理

## 关键设计决策

决策理由详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：

1. **WXT 而非 Plasmo**：Vue 3 一等支持、构建简洁
2. **Vue 3 而非 React**：UI 体量小，Vue 更轻
3. **Content Script `run_at: document_start`**：捕获 SPA 路由变化
4. **IndexedDB 而非 chrome.storage**：缓存容量无限制
5. **统一适配器接口**：新增翻译引擎只需实现 `ITranslationAdapter`
6. **API 代理服务（商业化）**：可选后端，用户不自带 Key 时按量计费转发，详见 [ARCHITECTURE.md §10](docs/ARCHITECTURE.md)

## 当前阶段

✅ **阶段 1：MVP 核心双语翻译 — 已完成**（2026-06-10）
92 tests · lint 0 · build 129 KB · 12/12 任务完成 + 5 项附加功能。
⚠️ 进入阶段 2 前建议测试更多网站（Medium/Reddit/GitHub/BBC 等），收集排版问题。
详见 [PLAN.md](docs/PLAN.md)
