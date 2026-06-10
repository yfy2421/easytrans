# 便捷翻译（Bianyi Translate）

> 轻量、开源、零追踪的双语对照翻译浏览器扩展

## 为什么做这个项目

沉浸式翻译（Immersive Translate）从开源转为闭源商业化后，存在以下问题：

- **源码闭源 + 代码混淆**：用户无法审计代码，无法确认隐私安全
- **追踪器植入**：移动端集成 Adjust、Meta Pixel、Google Analytics 等 7 个追踪器
- **翻译内容经中间服务器**：PDF/图片翻译需上传到第三方 OCR 服务
- **Freemium 收费**：AI 引擎（DeepL、OpenAI、Claude）需付费 Pro
- **隐私泄露事故**：2025 年 8 月分享快照功能因无访问控制导致用户合同、保单被搜索引擎公开索引

便捷翻译的定位：

> 做一个**聚焦核心场景、体验优秀、完全免费开源、零追踪**的双语对照翻译扩展。
>
> 翻译请求直接从浏览器发送到翻译 API，不经过任何中间服务器。代码开源，人人可审计。

## 核心原则

| 原则 | 说明 |
|------|------|
| **零追踪** | 不集成任何分析 SDK，不收集设备 ID，不记录使用行为 |
| **直连 API** | 翻译请求从浏览器直达 DeepL / OpenAI / Claude / Google，不经过中间服务器 |
| **完全开源** | 源码公开，人人可审计，不接受"隐私政策说一套、代码做一套" |
| **轻量优先** | 聚焦网页双语对照、输入框翻译、划词翻译三大核心场景 |
| **多引擎自由** | 用户自带 API Key，自由选择翻译引擎。也提供可选的内置 API 代理（按量计费），无需自行申请 Key |
| **开源可持续** | 代码完全开源，通过 API 代理差价维持项目运转，不做广告、不卖数据 |

## 核心功能（MVP）

1. **双语对照网页翻译**：段落级对照，原文在上、译文在下
2. **多翻译引擎**：Google 翻译、DeepL、OpenAI（ChatGPT）、Claude、Ollama（本地）
3. **输入框翻译**：输入框内输入中文，快捷键触发翻译为英文
4. **划词翻译**：选中文字弹出翻译
5. **鼠标悬停翻译**：悬停单词/短语即时翻译
6. **自定义规则**：指定哪些网站翻译、哪些不翻译、哪些区域跳过

## 技术栈

- **框架**：WXT（现代浏览器扩展开发框架，TypeScript-first，MV3 支持）
- **语言**：TypeScript
- **UI**：Vue 3（Popup + Options 页面）
- **存储**：chrome.storage.local（API Key、设置、翻译缓存）
- **构建**：Vite（WXT 内置）
- **目标平台**：Chrome / Edge / Firefox（后续考虑 Safari）
- **最低版本**：Chrome 88+ / Edge 88+ / Firefox 109+（Manifest V3 硬性要求，不兼容 IE 全系、旧版国产浏览器）

## 项目结构（规划）

```
便捷翻译/
├── README.md
├── CLAUDE.md
├── docs/
│   ├── ARCHITECTURE.md    # 架构设计文档
│   └── PLAN.md            # 实施计划与路线图
├── src/
│   ├── entrypoints/       # 入口（popup, content, background）
│   ├── components/        # Vue 组件
│   ├── lib/               # 核心逻辑
│   │   ├── translator/    # 翻译引擎适配层
│   │   ├── dom/           # DOM 文本提取与注入
│   │   ├── storage/       # 存储抽象
│   │   └── rules/         # 规则引擎
│   ├── styles/            # 全局样式
│   └── assets/            # 图标等资源
├── public/
│   └── icons/
├── tests/
├── wxt.config.ts
├── tsconfig.json
└── package.json
```

## 与现有开源替代品的差异

| 维度 | 便捷翻译 | KISS Translator | FluentRead | PairTranslate |
|------|---------|-----------------|------------|---------------|
| **隐私理念** | 零追踪、直连 API | 支持自建同步服务 | 本地处理 | 本地处理 |
| **框架** | WXT + Vue 3 | 油猴/扩展 | WXT + Vue 3 | 扩展 |
| **Claude 优化** | ✅ 专项优化 | 通用支持 | 通用支持 | ✅ |
| **本地模型** | Ollama 支持 | Ollama 支持 | 不支持 | 不支持 |
| **扩展模式** | MV3 首选 | 油猴优先 | MV3 | MV3 |

核心差异：便捷翻译在**隐私优先 + Claude/LLM 翻译体验优化**上做深度，不追求功能覆盖面。

## 许可证

开源协议待定（AGPL-3.0 或 MIT）

## 开发状态

🚧 规划阶段
