# 架构设计文档 — 便捷翻译

> 版本: 0.1.0 | 状态: 草案 | 最后更新: 2026-06-09

---

## 1. 总体架构

### 1.1 架构原则

1. **请求直连（默认）**：自带 API Key 的用户，翻译请求从浏览器直接发到翻译 API，不经过中间服务器。**可选 API 代理**：不愿自行申请 Key 的用户，可使用内置的 API 代理服务（按量计费），此为显式知情选择，非强制
2. **最小权限**：Manifest V3 权限最小化，仅申请必要权限
3. **存储保密**：API Key 等敏感信息仅存储在 `chrome.storage.local`，不上传任何服务器
4. **可测试性**：核心逻辑与浏览器 API 解耦，可独立单元测试
5. **渐进增强**：MVP 先做核心，高级功能通过插件机制扩展

### 1.2 四层架构

```
┌──────────────────────────────────────────┐
│              UI Layer                     │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ │
│  │ Popup   │ │ Options  │ │ In-Page   │ │
│  │ Panel   │ │ Page     │ │ Overlays  │ │
│  └────┬────┘ └────┬─────┘ └─────┬─────┘ │
│       │           │             │       │
├───────┴───────────┴─────────────┴───────┤
│           Service Layer                  │
│  ┌─────────────────────────────────────┐ │
│  │        Background Worker            │ │
│  │  ┌──────────┐  ┌─────────────────┐  │ │
│  │  │ Translator│  │ Cache Manager   │  │ │
│  │  │ Dispatcher│  │ (LFU + TTL)     │  │ │
│  │  └──────────┘  └─────────────────┘  │ │
│  │  ┌──────────┐  ┌─────────────────┐  │ │
│  │  │ Rule      │  │ Storage         │  │ │
│  │  │ Engine    │  │ Abstraction      │  │ │
│  │  └──────────┘  └─────────────────┘  │ │
│  └─────────────────────────────────────┘ │
│       │                                  │
├───────┴──────────────────────────────────┤
│          Content Script Layer            │
│  ┌─────────────────────────────────────┐ │
│  │  ┌──────────┐  ┌─────────────────┐  │ │
│  │  │ DOM Text │  │ Translation     │  │ │
│  │  │ Extractor│  │ Injector         │  │ │
│  │  └──────────┘  └─────────────────┘  │ │
│  │  ┌──────────┐  ┌─────────────────┐  │ │
│  │  │ Input Box│  │ Selection/Hover │  │ │
│  │  │ Handler  │  │ Handler         │  │ │
│  │  └──────────┘  └─────────────────┘  │ │
│  │  ┌─────────────────────────────────┐ │ │
│  │  │ MutationObserver (DOM change)   │ │ │
│  │  └─────────────────────────────────┘ │ │
│  └─────────────────────────────────────┘ │
│       │                                  │
├───────┴──────────────────────────────────┤
│           Adapter Layer                  │
│  ┌─────────────────────────────────────┐ │
│  │  Google │ DeepL │ OpenAI │ Claude   │ │
│  │  (Free) │ (API) │ (API)  │ (API)    │ │
│  │         │       │        │          │ │
│  │  Ollama │ Gemini│ DeepSeek│ Custom  │ │
│  │  (Local)│ (API) │ (API)   │ (API)   │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

---

## 2. 关键架构决策

### 2.1 为什么选 WXT 而不是 Plasmo 或纯手写

| 维度 | WXT | Plasmo | 纯手写 MV3 |
|------|-----|--------|-----------|
| TypeScript 支持 | ✅ 内置 | ✅ 内置 | ⚠️ 自行配置 |
| MV3 支持 | ✅ 完整 | ✅ 完整 | ⚠️ 需自行理解规范 |
| HMR 热更新 | ✅ 快 | ✅ 快 | ❌ 手动刷新 |
| Vue 3 集成 | ✅ 官方支持 | ⚠️ React-first | N/A |
| 跨浏览器构建 | ✅ 内置 | ✅ 内置 | ❌ 手动处理差异 |
| 学习曲线 | 低 | 中 | 高 |
| 社区活跃度 | 中 | 高 | N/A |
| Bundle 大小 | 小 | 中 | 可控 |

**选择 WXT 的理由**：
- 对 Vue 3 有官方一等支持（我们的 UI 选型）
- 构建产出简洁，不引入过多框架代码
- `wxt.config.ts` 统一管理所有浏览器差异

### 2.2 为什么 UI 选 Vue 3 而不是 React

- 本项目 UI 体量小（Popup + Options），不需要 React 生态的重量级状态管理
- Vue 3 Composition API + 单文件组件足够
- Claude AI 对 Vue 3 和 React 的代码生成质量相当
- Vue 3 的模板语法更接近原生 HTML，阅读门槛更低

### 2.3 Content Script 设计

```
Content Script 运行在 "isolated world"，与页面 JS 隔离

┌──────────────────────────────┐
│      Web Page Context        │
│  ┌────────────────────────┐  │
│  │     Page JS             │  │
│  │  (无法访问 Content       │  │
│  │   Script 的变量)         │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │  Content Script         │  │
│  │  - DOM 访问 ✅           │  │
│  │  - window.postMessage   │  │
│  │  - chrome.runtime       │  │
│  │  - MutationObserver     │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**为什么用 `run_at: document_start`**：
- 在页面开始渲染时就注册 MutationObserver
- 可以捕获到 SPA 路由切换时的 DOM 变化
- 避免用户看到"原文闪现再变译文"的闪烁

### 2.4 页面内交互模式

用户不点扩展图标就能触发翻译。三种入口分层互补：

```
┌──────────────────────────────────┐
│                           ┌──┐   │
│   网页内容                  │译│   │  ← 悬浮球（Content Script 注入）
│                           └──┘   │     默认右下角，可拖拽
│                                   │     Shadow DOM 隔离样式
│  首次检测到外文页面时：             │
│  ┌─────────────────────────────┐  │
│  │ 🌐 检测到英文 · [翻译] [✕]  │  │  ← 顶部提示条（显示 5s 自动消失）
│  └─────────────────────────────┘  │     "永不翻译此站" 记住选择
└──────────────────────────────────┘
```

**三层触发机制**：

| 层 | 入口 | 优先级 | 说明 |
|----|------|:---:|------|
| 1 | 顶部提示条 | 自动 | 检测到外文页面自动弹出，最不需要学习 |
| 2 | 悬浮球 | 手动 | 始终可见，可拖拽重新定位，点击弹出迷你菜单 |
| 3 | 右键 + 快捷键 | 备选 | 零视觉干扰，`Ctrl+Shift+T` 切换翻译 |

悬浮球菜单：
```
点击悬浮球 →
  ┌──────────┐
  │ 翻译此页  │
  │ 还原原文  │
  │ 设置     │  → 打开 Options 页面
  └──────────┘
```

技术要点：
- 悬浮球用 **Shadow DOM** 隔离，不被页面 CSS 污染
- 拖拽用 `pointerdown/move/up` 实现，不依赖第三方库
- 位置存 `chrome.storage.local`，跨页面记住
- 顶部提示条：检测 `html[lang]` 或前 500 个文本节点语言 → 非目标语言时弹出
- "永不翻译此站" 写入规则引擎（URL 匹配 → `action: skip`）

### 2.5 翻译请求流

```
用户触发翻译
    │
    ▼
Content Script 收集待翻译文本节点
    │
    ▼
发送消息到 Background Worker
    │
    ├─ 检查缓存（LFU + TTL）
    │   ├─ 命中 → 返回缓存结果
    │   └─ 未命中 ↓
    │
    ▼
翻译适配层选择引擎
    │
    ├─► 用户自带 Key（直达 API）
    │   ├─ Google (免费，无需 Key)
    │   │    └─ fetch("https://translate.googleapis.com/...")
    │   ├─ DeepL
    │   │    └─ fetch("https://api-free.deepl.com/v2/translate", headers: {Auth})
    │   ├─ OpenAI
    │   │    └─ fetch("https://api.openai.com/v1/chat/completions", headers: {Auth})
    │   ├─ Claude
    │   │    └─ fetch("https://api.anthropic.com/v1/messages", headers: {Auth})
    │   └─ Ollama (本地)
    │        └─ fetch("http://localhost:11434/api/generate", body: {model, prompt})
    │
    └─► 未配置 Key（使用 API 代理）
         └─ fetch("https://bianyi-api.example.com/v1/translate", body: {text, engine, targetLang})
              │
              ▼
         代理服务器转发到对应引擎 → 返回结果
              │
              ▼
         按量计费，从用户余额扣除
    │
    ▼
翻译结果返回 Content Script
    │
    ▼
Content Script 注入译文到 DOM
```

### 2.6 缓存策略

```
┌─────────────────────────────┐
│     Translation Cache       │
│                             │
│  Key: hash(原文 + 引擎 + 目标语言)  │
│  Value: { translation, ts } │
│                             │
│  淘汰策略: LFU + TTL        │
│  - TTL: 7 天（可配置）       │
│  - 容量: 10000 条（可配置）   │
│  - 存储: IndexedDB          │
│                             │
│  chrome.storage.local 限制: │
│  - 单条最大 10MB            │
│  - 总计约 10MB（实际更大）    │
│                             │
│  IndexedDB 更合适:          │
│  - 无大小限制（取决于磁盘）    │
│  - 支持索引查询             │
│  - 异步 API                │
└─────────────────────────────┘
```

---

## 3. 翻译引擎适配层

### 3.1 统一接口

```typescript
// src/lib/translator/types.ts

interface TranslationRequest {
  text: string;
  sourceLang: string;   // 'auto' | 'zh' | 'en' | ...
  targetLang: string;   // 'zh' | 'en' | 'ja' | ...
  engine: TranslationEngine;
}

interface TranslationResponse {
  translatedText: string;
  engine: TranslationEngine;
  model?: string;       // 具体模型名（LLM 场景）
  latency: number;      // 耗时 ms
}

interface TranslationEngineConfig {
  type: TranslationEngine;
  apiKey?: string;
  apiUrl?: string;      // 自定义端点（Ollama / 代理）
  model?: string;       // LLM 模型名
  options?: Record<string, unknown>;
}

// 每个引擎实现这个接口
interface ITranslationAdapter {
  readonly engine: TranslationEngine;
  translate(req: TranslationRequest, config: TranslationEngineConfig): Promise<TranslationResponse>;
  validate(config: TranslationEngineConfig): boolean;
  getModels?(): Promise<string[]>;  // 获取可用模型列表（LLM）
}
```

### 3.2 各引擎特点

| 引擎 | 免费额度 | 翻译质量 | 速度 | 隐私性 | 是否需要 Key |
|------|---------|---------|------|--------|-------------|
| Google 翻译 | 无限（非官方 API） | 中等 | 快 | 低——文本发送给 Google | ❌ |
| DeepL Free | 50 万字符/月 | 高 | 快 | 中——文本发送给 DeepL | ✅ |
| OpenAI | 付费 | 很高 | 中 | 取决于你对 OpenAI 的信任 | ✅ |
| Claude | 付费 | 很高（适合长文本/技术文档） | 中 | 取决于你对 Anthropic 的信任 | ✅ |
| Ollama | 无限（本地） | 取决于模型 | 取决于硬件 | 极高——完全本地 | ❌ |
| DeepSeek | 付费（便宜） | 高 | 中 | 中 | ✅ |

### 3.3 Claude 翻译的专项优化

Claude 相对传统翻译引擎的优势在于**上下文理解 + 术语一致性**。专门设计 Prompt 模板：

```
System Prompt（翻译场景）:
"You are a professional translator specializing in {domain}.
 Translate the following {sourceLang} text to {targetLang}.
 Rules:
 1. Maintain the original formatting (line breaks, HTML tags)
 2. Keep technical terms consistent throughout
 3. For code blocks and variable names, do NOT translate
 4. Preserve the tone and style of the original
 5. If the text contains untranslatable elements (URLs, emails, numbers),
    leave them unchanged"
```

---

## 4. DOM 文本提取策略

### 4.1 文本节点收集

```
TreeWalker (NodeFilter.SHOW_TEXT)
    │
    ▼
过滤不可见节点:
  - display: none
  - visibility: hidden
  - opacity: 0
  - <script>, <style>, <noscript>
  - aria-hidden="true"
    │
    ▼
排除非内容标签:
  - <code>, <pre>, <kbd>, <var>
  - <nav>, <footer>, <header>（可配置）
  - [translate="no"]
    │
    ▼
文本分块:
  - 按段落/块级元素分组
  - 保持上下文关联
  - 去除纯空白节点
    │
    ▼
发送翻译请求（去重 + 缓存检查）
```

### 4.2 Shadow DOM 处理

越来越多的网站使用 Shadow DOM（如 YouTube、GitHub、各类 Web Component）：
- 常规 `TreeWalker` 无法穿透 Shadow Root
- 需要递归进入 `element.shadowRoot`
- 使用 `deepTextNodeIterator` 模式

```typescript
function* deepTextNodes(root: Node): Generator<Text> {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text)) {
    if (isTranslatable(node)) yield node;
  }
  // Recursively walk into Shadow DOM
  const elWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let el: Element | null;
  while ((el = elWalker.nextNode() as Element)) {
    if (el.shadowRoot) yield* deepTextNodes(el.shadowRoot);
  }
}
```

### 4.3 译文注入方式

```
原文段落:
┌──────────────────────────────────┐
│ This is the original paragraph   │
│ that needs to be translated.     │
└──────────────────────────────────┘

注入后（双语对照）:
┌──────────────────────────────────┐
│ This is the original paragraph   │  ← 原文（不变）
│ that needs to be translated.     │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│ 这是需要翻译的原始段落。          │  ← 译文（新增 span）
└──────────────────────────────────┘
```

实现方式：
- **不修改原文 DOM 结构**——原文保持原样
- 在每个翻译单元后插入一个 `div.translate-bianyi` 
- 用视觉分隔（虚线 / 浅色背景 / 字号略小）区分译文
- 所有样式通过 Shadow DOM 隔离，避免被页面 CSS 污染

---

## 5. 规则引擎

### 5.1 规则模型

```typescript
interface TranslationRule {
  id: string;
  enabled: boolean;
  // 匹配条件
  urlPattern: string;        // glob: "*.github.com/*"
  selector: string;          // CSS selector: "article.main-content"
  // 行为
  action: 'translate' | 'skip' | 'translate-only';
  // 选项
  targetLang?: string;       // 指定目标语言
  engine?: TranslationEngine; // 指定引擎
}
```

### 5.2 规则优先级

```
1. 用户自定义规则（最高优先级）
2. 内置规则（针对特定网站的优化规则）
3. 全局默认设置（最低优先级）

同优先级下: 更具体的 URL 匹配 > 更宽泛的
```

---

## 6. 跨浏览器兼容策略

### 6.1 WXT 统一构建

WXT 自动处理以下差异：
- `chrome.*` vs `browser.*` API
- Manifest V2 vs V3
- Service Worker vs Background Page

### 6.2 已知差异清单

| 特性 | Chrome | Firefox | Edge | Safari |
|------|--------|---------|------|--------|
| Manifest V3 | ✅ | ✅ | ✅ | ⚠️ 部分 |
| Service Worker | ✅ | ✅ | ✅ | ❌ 用 Background |
| `declarativeNetRequest` | ✅ | ✅ | ✅ | ⚠️ 有限 |
| Side Panel | ✅ | ❌ | ✅ | ❌ |
| Offscreen Documents | ✅ | ❌ | ✅ | ❌ |
| `userScripts` API | ✅ | ✅ | ✅ | ❌ |

### 6.3 渐进式平台支持

```
第一期: Chrome + Edge（共用 Chromium 生态）
第二期: Firefox（wxt build --firefox）
第三期: Safari（需要 macOS + Xcode）
```

---

## 7. 安全设计

### 7.1 API Key 安全

```
威胁模型:
- 其他扩展无法读取你的 chrome.storage.local（沙箱隔离）
- 网页 JS 无法访问 chrome.storage.local
- 但：如果用户电脑被恶意软件控制，本地存储的一切都可读

对策:
- API Key 仅存 chrome.storage.local，加密存储（可选）
- 传输层：所有 API 调用使用 HTTPS
- 提示用户使用 API Key 的权限最小化（只读 Key / 用量限制）
```

### 7.2 XSS 防护

```
Content Script 注入的译文内容:
- 使用 textContent 而不是 innerHTML
- 如果必须用 innerHTML: DOMPurify 清洗
- HTML 实体转义
```

### 7.3 CSP 配置

```json
// manifest.json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src https://api.anthropic.com https://api.openai.com https://api-free.deepl.com https://translate.googleapis.com http://localhost:11434"
  }
}
```

---

## 8. 测试策略

| 层 | 测试类型 | 工具 | 覆盖目标 |
|----|---------|------|---------|
| Adapter | 单元测试 | Vitest | 每个翻译引擎适配器 |
| DOM 工具 | 单元测试 | Vitest + jsdom | 文本提取 / 注入函数 |
| 规则引擎 | 单元测试 | Vitest | 匹配逻辑 |
| Content Script | 集成测试 | Playwright (扩展模式) | 真实网页翻译 |
| UI (Popup/Options) | 组件测试 | Vitest + Vue Test Utils | Vue 组件 |
| E2E | 端到端 | Playwright | 完整翻译流程 |

### 8.1 测试原则

- **TDD**：红 → 绿 → 重构（遵循项目根 `.trae/rules/tdd.md` 规范）
- 适配器层必须 100% mock 外部 API 调用
- DOM 操作相关的测试使用 jsdom 模拟

---

## 9. 依赖项

### 运行时

| 包名 | 用途 | 是否必须 |
|------|------|---------|
| wxt | 扩展框架 | ✅ |
| vue | UI 框架 | ✅ |
| @vueuse/core | Vue 组合式工具库 | ✅ |
| idb-keyval | IndexedDB 简化封装 | ✅ |
| dompurify | HTML 清洗 | ✅ |

### 开发时

| 包名 | 用途 |
|------|------|
| typescript | 类型检查 |
| vitest | 测试框架 |
| @playwright/test | E2E 测试 |
| @vue/test-utils | Vue 组件测试 |
| jsdom | DOM 模拟 |
| eslint + prettier | 代码规范 |

---

## 10. API 代理服务（商业化）

### 10.1 定位

API 代理是一个**可选的后端服务**，面向不想自行申请 API Key 的用户。用户在知情的前提下选择使用代理服务，按量计费。自带 Key 的用户仍然直连 API，不受任何影响。

```
                          ┌────────────┐
                          │  浏览器扩展  │
                          └─────┬──────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
    ┌─────────────────────┐      ┌─────────────────────┐
    │  直连 API（自带 Key） │      │  代理 API（无 Key）   │
    │                     │      │                     │
    │  fetch("api.xxx")   │      │  fetch("bianyi-api   │
    │  + Authorization    │      │   .example.com")    │
    │  Header             │      │  + 用户身份 Token    │
    └──────────┬──────────┘      └──────────┬──────────┘
               │                            │
               ▼                            ▼
    ┌─────────────────┐         ┌─────────────────────┐
    │ DeepL / Claude / │         │    API 代理服务器     │
    │ OpenAI / Google  │         │  ┌───────────────┐  │
    └─────────────────┘         │  │ 用户余额验证    │  │
                                │  ├───────────────┤  │
                                │  │ 转发到目标引擎  │  │
                                │  ├───────────────┤  │
                                │  │ 用量记录 + 扣费 │  │
                                │  ├───────────────┤  │
                                │  │ 滥用检测        │  │
                                │  └───────────────┘  │
                                └──────────┬──────────┘
                                           │
                                           ▼
                                ┌─────────────────────┐
                                │ DeepL / Claude /     │
                                │ OpenAI / Google      │
                                └─────────────────────┘
```

### 10.2 核心原则

| 原则 | 说明 |
|------|------|
| **知情选择** | 用户明确看到"使用代理 vs 自带 Key"两个选项，默认引导自带 Key |
| **按量计费** | 按实际 API 调用量扣费，余额清晰可见，不搞虚拟金币/充值卡 |
| **透明定价** | 公开代理价格 = 上游 API 成本 + 服务溢价，用户可以自行计算是否划算 |
| **零追踪延伸** | 代理服务器不记录翻译内容、不分析用户行为、不关联用户身份 |
| **可选部署** | 技术上可自建代理服务端，扩展支持配置自定义代理 URL |

### 10.3 技术实现

**扩展端**：

```typescript
// src/lib/translator/dispatcher.ts

interface TranslationContext {
  engine: TranslationEngine;
  // 方案 A：用户自带 Key
  apiKey?: string;
  // 方案 B：使用 API 代理
  useProxy?: boolean;
  proxyToken?: string;  // 用户身份验证
}

async function dispatch(req: TranslationRequest, ctx: TranslationContext): Promise<TranslationResponse> {
  if (ctx.apiKey && !ctx.useProxy) {
    // 直连路径
    return getAdapter(ctx.engine).translate(req, { apiKey: ctx.apiKey });
  }
  // 代理路径
  return proxyTranslate(req, ctx);
}

async function proxyTranslate(req: TranslationRequest, ctx: TranslationContext): Promise<TranslationResponse> {
  const res = await fetch(`${PROXY_BASE_URL}/v1/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ctx.proxyToken}`,
    },
    body: JSON.stringify({
      text: req.text,
      engine: req.engine,
      source_lang: req.sourceLang,
      target_lang: req.targetLang,
    }),
  });
  if (res.status === 402) throw new InsufficientBalanceError();
  return res.json();
}
```

**服务端**（TypeScript + Node.js，与扩展同语言）：

```
API 代理服务器端点:

POST   /v1/auth/login        # 邮箱 + 验证码登录（返回 Token）
POST   /v1/auth/refresh      # 刷新 Token
POST   /v1/translate         # 翻译请求（核心）
GET    /v1/engines           # 可用引擎列表 + 价格
GET    /v1/account/balance   # 查询余额
POST   /v1/account/recharge  # 充值（易支付回调）
GET    /v1/usage/history     # 用量历史
DELETE /v1/devices/:id       # 解绑设备

管理端点（内部）:
POST   /admin/users          # 用户管理
GET    /admin/stats          # 用量统计
```

### 10.4 用户注册与认证

**最简方案：邮箱 + 验证码登录。**

不需要密码——密码体系（注册/重置/加密存储）复杂度太高，邮箱验证码零成本且足够用。扩展打开时 Token 自动刷新，用户几乎无感。

```
注册流程:
  → 输入邮箱
  → 收到 6 位验证码（5 分钟有效）
  → 输入验证码 → 服务端生成用户 + 返回 JWT Token
  → Token 存 chrome.storage.local

后续请求:
  → Authorization: Bearer <JWT>
  → Token 过期 → 发新验证码刷新 Token（免重新登录）
```

为什么不需要更多：
- **不防批量注册**：邮箱验证码拦不住临时邮箱，但这无所谓——预付费制下，不充钱注册一万个也浪费不了你的 API 费用
- **不设密码**：浏览器扩展不像网站，用户每天不需要登出登入。邮箱验证码就够了
- **不做 OAuth（GitHub/Google）**：MVP 不做，后续可补

### 10.5 支付渠道

使用**易支付（第三方聚合平台）**作为支付网关，个人开发者无需营业执照即可接入微信/支付宝。

```
充值流程:
  扩展端 → POST /v1/account/recharge { amount }
  服务端 → 生成订单（唯一 orderId）→ 调用易支付下单 → 返回支付链接
  扩展端 → 打开支付页面（用户扫码）
  易支付 → 异步回调 POST /v1/payment/callback { orderId, status, sign }
  服务端 → 验证签名 → 检查 orderId 是否已处理（幂等）→ 增加余额
```

关键点：
- **幂等性**：订单号唯一，回调中 `SELECT ... WHERE order_id` 查重，已处理的回调直接返回成功
- **签名验证**：必须验易支付回调签名，防止伪造回调
- **手续费**：易支付约 2-4%，已计入 10.6 定价模型的溢价中

### 10.6 余额耗尽处理

翻译开始前预估总费用（扩展端已知待翻译文本量）。余额不足时拒绝翻译，避免译到一半余额不够。

**扩展端预检逻辑**：

```typescript
// src/lib/translator/dispatcher.ts

async function translateWithBalanceCheck(
  texts: string[], engine: TranslationEngine, balance: number
): Promise<TranslationResult> {
  const estimatedCost = estimateCost(texts.join(''), engine);
  if (balance < estimatedCost) {
    return { error: 'INSUFFICIENT_BALANCE', estimatedCost, balance };
  }
  return proxyTranslate(texts, engine);
}
```

**余额尾量豁免**（用户不因差一点钱而译文截断）：

```
单次翻译请求中，如果剩余需翻译文本预估费用 ≤ ¥0.3：
  → 免去超出部分费用（余额扣到 0，不是扣到负数）
  → 翻译完成后弹提示："余额已用完，本次翻译剩余 ¥0.X 由我们请客"
  → 提示包含一键充值的链接
```

为什么 ¥0.3：价格约等于 Claude 翻译 5000 字的费用。阈值足够小，用户没法"薅羊毛"，但体验提升显著。这个值在服务端配置，可调。

### 10.7 定价模型

```
用户余额 = 充值金额
每次翻译扣费 = 上游 API 成本 × (1 + 溢价率) × 字符数

示例（每百万字符）:
  DeepL:  上游 $25 + 溢价 30% = 用户付 $32.5
  Claude: 上游 $15 + 溢价 40% = 用户付 $21
  Google: 上游 $20 + 溢价 30% = 用户付 $26
```

溢价用于覆盖：服务端运维成本、支付渠道手续费、坏账准备金、开发维护。

### 10.8 防滥用措施

| 措施 | 说明 |
|------|------|
| 速率限制 | 每用户 QPS 上限（可配置） |
| 单次上限 | 单次请求最多 N 字符 |
| 新用户限额 | 新账号 24h 内消费上限 |
| 异常检测 | 异常流量模式自动暂停 + 人工审核 |
| 无免费试用额度 | 避免批量注册薅羊毛（可选改为少量体验额度） |

### 10.9 部署考量

- 代理服务器独立于扩展发布，可独立扩缩容
- 初期单节点部署即可（用户量小），后续可水平扩展
- 数据库：SQLite（MVP，用户量小零运维）→ 日均请求过万时迁移 PostgreSQL
- 缓存：Redis（余额热数据、速率限制计数器）——可先不做，MVP 直接读 SQLite 也够
- 翻译内容**不落盘**，仅在内存中转发，日志不记录原文/译文
- 扩展端提供**自定义代理 URL** 配置项，高级用户可自建代理服务

### 10.10 设备绑定与分级定价

**目的**：防止账号共享/转售，同时为付费升级提供自然动机。

每个账号可绑定的设备数量由套餐决定。设备标识在扩展首次安装时生成，基于浏览器指纹（无需个人隐私信息）：

```typescript
// 设备指纹（扩展端生成，仅用于唯一标识，不含个人数据）
interface DeviceFingerprint {
  deviceId: string;       // 随机 UUID，安装时生成并存储于 chrome.storage.local
  browser: string;        // "chrome" | "firefox" | "edge"
  created: number;        // 安装时间戳
}
```

**设备绑定流程**：

```
扩展首次安装
  → 生成 deviceId（UUID v4）存入 chrome.storage.local
  → 用户登录时随 Token 上报 deviceId
  → 服务端检查：该账号已绑定设备数 < 套餐上限？
      → 是：绑定成功，返回会话 Token
      → 否：返回 403 + 已绑定设备列表，提示升级套餐
```

**扩展端实现要点**：
- `deviceId` 存 `chrome.storage.local`，卸载扩展时会被浏览器清除
- 重装扩展视为新设备，会占用一个槽位
- 用户可在 Options 页面管理已绑定设备（解绑旧设备）

**服务端表结构**：

```sql
CREATE TABLE user_devices (
  user_id    UUID REFERENCES users(id),
  device_id  UUID,
  browser    VARCHAR(20),
  bound_at   TIMESTAMPTZ DEFAULT now(),
  last_seen  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, device_id)
);
-- 查询绑定数：SELECT COUNT(*) FROM user_devices WHERE user_id = $1
```

**定价套餐示例**：

| 套餐 | 价格 | 绑定设备数 | 目标用户 |
|------|------|:---:|------|
| 个人基础 | ¥10 起充 | 2 台 | 一台电脑 + 一台手机 |
| 个人 Plus | ¥30 起充 | 5 台 | 多设备用户、家庭共享 |
| 团队 | ¥100 起充 | 20 台 | 小团队、工作室 |

升级动机：
- 用户用了两台设备后发现不够 → 自然想升 Plus
- 不需要限制翻译质量/速度（那会损害核心体验），只限制设备数
- 用户感知是"为多设备便利付费"，不是"为翻译质量付费"

### 10.11 皮肤系统（增值付费）

**目的**：低成本的视觉付费点，不干扰核心翻译功能。

**设计原则**：
- 默认皮肤永远免费，翻译功能不因皮肤受限
- 皮肤 = 纯 CSS 变量切换，零性能开销
- 不弹推广、不锁功能、不逼用户
- 用户不主动进 Options → 永远不知道皮肤存在

**技术实现**：

悬浮球和译文样式通过 CSS 变量控制，切换皮肤 = 更换变量值：

```css
/* 默认紫色 */
:root {
  --bianyi-accent: #4f46e5;
  --bianyi-ball-bg: #4f46e5;
  --bianyi-translation-color: #6b7280;
  --bianyi-translation-border: #c7d2fe;
}

/* 猫爪粉 */
[data-bianyi-skin="catpaw"] {
  --bianyi-accent: #f472b6;
  --bianyi-ball-bg: linear-gradient(135deg, #f472b6, #fb923c);
  --bianyi-translation-border: #fbcfe8;
}

/* 森林绿 */
[data-bianyi-skin="forest"] {
  --bianyi-accent: #059669;
  --bianyi-ball-bg: linear-gradient(135deg, #059669, #34d399);
  --bianyi-translation-border: #a7f3d0;
}
```

**皮肤包分级**：

| 级别 | 内容 | 价格 | 说明 |
|------|------|------|------|
| 免费基础 | 3 款（默认紫 / 简约灰 / 暗夜黑） | ¥0 | 所有人可用 |
| 付费皮肤包 | 6-8 款（猫爪 / 森林 / 海洋 / 日落 / 像素 / 霓虹 / 极光 / 水墨） | ¥3-5 一次性买断 | Options 页面解锁 |
| 自定义 CSS | 高级用户自己写 CSS | 免费 | 跟付费不冲突 |

**收益预测**（粗估）：
- 假设 DAU 1000，付费转化率 3-5%
- 30-50 人 × ¥5 = ¥150-250
- 不是主要收入来源，但**零边际成本**（一套 CSS 卖无限份）

### 10.12 拖拽特效（远期彩蛋）

水波/粒子拖尾等视觉效果实现方案：

- Canvas 覆盖层 + `pointer-events: none`（不挡点击）
- 粒子系统：拖拽时在路径上生成彩色粒子，渐变缩小 + 淡出
- 性能保护：`requestAnimationFrame` 节流，低配机自动降级

**不作为独立付费点**——打包进付费皮肤包里作为 Premium 皮肤的附加特效。单独卖"水波"显得太微交易，不如"买个皮肤包附送特效"用户感知好。

### 10.13 商业化收入结构总览

| 收入来源 | 类型 | 预估占比 | 状态 |
|------|------|:--:|------|
| API 代理差价 | 持续性 | 80% | 阶段 2 动工 |
| 付费皮肤包 | 一次性 | 10% | 阶段 2-3 |
| 设备套餐升级 | 持续性 | 10% | 阶段 2 |
| 捐赠（爱发电/GitHub） | 自愿 | 补充 | 随时可上 |

核心逻辑：API 代理是饭碗，皮肤和设备套餐是零花钱。先保饭碗，再做零花钱。
