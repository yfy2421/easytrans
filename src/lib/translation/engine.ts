/**
 * TranslationEngine — 翻译管线，将提取→缓存→API→注入串成单一流程。
 * content.ts 只需调 `engine.translate(document)`。
 */
import { extractTextNodes, type TextChunk } from '@/lib/dom/extractor';
import { injectTranslations } from '@/lib/dom/injector';
import { replaceTextNodes, restoreTextNodes, isReplaceable } from '@/lib/dom/replacer';
import { matchRule } from '@/lib/rules/engine';
import type { TranslateResponseMsg } from '@/lib/messages';

export type TranslationMode = 'append' | 'replace';

export interface EngineConfig {
  mode: TranslationMode;
  targetLang: string;
  /** Called when batches start/complete */
  onProgress?: (phase: 'extract' | 'translate' | 'apply' | 'done') => void;
}

const CONCURRENT_BATCH_SIZE = 50;
const PUNCTUATION_RE = /^[\d\s.,;:!?()[\]{}<>\/\\|@#$%^&*+=~`'"_-]+$/;
const CJK_RE = /[一-鿿㐀-䶿]/g;

// ── public API ──

export class TranslationEngine {
  private config: EngineConfig;
  private cache = new Map<string, string>();
  private cancelled = false;
  private keepalive: ReturnType<typeof setInterval> | null = null;

  constructor(config: EngineConfig) {
    this.config = config;
  }

  cancel(): void { this.cancelled = true; }

  setMode(mode: TranslationMode): void { this.config.mode = mode; }

  async translate(doc: Document): Promise<void> {
    this.cancelled = false;
    const { mode, targetLang, onProgress } = this.config;
    const isAppend = mode === 'append';

    // ── 1. Scope + Extract ──
    onProgress?.('extract');
    const scopeRoot = resolveScope(doc, isAppend);
    const chunks = extractTextNodes(scopeRoot, isAppend)
      .filter((c) => {
        const t = c.text.trim();
        if (PUNCTUATION_RE.test(t)) return false;
        if (t.length < 3) return false;
        if (isTargetLang(t, targetLang)) return false;
        return true;
      });

    if (chunks.length === 0) { onProgress?.('done'); return; }

    // ── 2. Cache split (mode-specific key to avoid cross-mode pollution) ──
    const cacheKey = (text: string) => `${mode}::${text}::${targetLang}`;
    const cached: { chunk: TextChunk; translated: string }[] = [];
    const uncached: TextChunk[] = [];
    for (const c of chunks) {
      const hit = this.cache.get(cacheKey(c.text));
      if (hit) cached.push({ chunk: c, translated: hit });
      else uncached.push(c);
    }

    // All cached, no API needed
    if (uncached.length === 0) {
      if (mode === 'append') {
        injectTranslations(cached.map(({ chunk, translated }) => ({ chunk, translatedText: translated })));
      }
      onProgress?.('done');
      return;
    }

    // ── 3. Send to API ──
    onProgress?.('translate');
    this.startKeepalive();

    const sendList = isAppend
      ? uncached.map((c) => ({ text: c.text, meta: { chunk: c } }))
      : uncached.flatMap((c) =>
          c.nodes
            .filter((n) => isReplaceable(n) && (n.textContent?.trim()?.length ?? 0) >= 3)
            .map((n) => {
              const text = n.textContent!.trim();
              const hit = this.cache.get(cacheKey(text));
              // Apply cached node translation immediately
              if (hit) { replaceTextNodes([{ node: n, translatedText: hit }]); return null; }
              return { text, meta: { chunk: c, node: n } };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null),
        );

    const appendEntries: { chunk: TextChunk; translatedText: string }[] = isAppend
      ? cached.map(({ chunk, translated }) => ({ chunk, translatedText: translated }))
      : [];

    // Split into concurrent batches
    const batchList: { batch: typeof sendList; index: number }[] = [];
    for (let i = 0; i < sendList.length && !this.cancelled; i += CONCURRENT_BATCH_SIZE) {
      batchList.push({ batch: sendList.slice(i, i + CONCURRENT_BATCH_SIZE), index: i });
    }

    // Concurrent batch dispatch — results applied as each batch returns
    await Promise.all(
      batchList.map(async ({ batch, index }) => {
        if (this.cancelled) return;
        const texts = batch.map((x) => x.text);
        const n = Math.floor(index / CONCURRENT_BATCH_SIZE) + 1;
        try {
          const r: TranslateResponseMsg = await browser.runtime.sendMessage({
            type: 'TRANSLATE_REQUEST', texts,
            sourceLang: 'auto', targetLang, engine: 'google',
          });

          for (let j = 0; j < batch.length; j++) {
            const translated = r.translations[j]?.translated || '';
            if (translated) this.cache.set(cacheKey(batch[j].text), translated);

            if (isAppend) {
              appendEntries.push({ chunk: batch[j].meta.chunk, translatedText: translated });
            } else if (batch[j].meta.node && translated) {
              replaceTextNodes([{ node: batch[j].meta.node!, translatedText: translated }]);
            }
          }
        } catch (err) {
          console.warn(`[TranslationEngine] Batch ${n} failed:`, err);
        }
      }),
    );

    this.stopKeepalive();
    if (this.cancelled) return;

    // ── 4. Apply (append mode: all at once) ──
    onProgress?.('apply');
    if (isAppend) {
      injectTranslations(appendEntries.filter((e) => e.translatedText));
    }
    onProgress?.('done');
  }

  private startKeepalive(): void {
    this.keepalive = setInterval(() => {
      browser.runtime.sendMessage({ type: 'PING' }).catch(() => {});
    }, 15_000);
  }

  private stopKeepalive(): void {
    if (this.keepalive) { clearInterval(this.keepalive); this.keepalive = null; }
  }
}

// ── helpers ──

function resolveScope(doc: Document, skipUi: boolean): HTMLElement {
  if (skipUi) {
    const matched = matchRule(doc.URL);
    if (matched?.containerSelector) {
      const el = doc.querySelector(matched.containerSelector) as HTMLElement | null;
      if (el) return el;
    }
  }
  return doc.body;
}

function isTargetLang(text: string, target: string): boolean {
  if (target === 'zh' || target === 'zh-TW') {
    const cjk = text.match(CJK_RE);
    return cjk ? cjk.length / text.length > 0.3 : false;
  }
  return false;
}
