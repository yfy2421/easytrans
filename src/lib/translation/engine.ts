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

    // ── 2. Cache split ──
    const cacheKey = (text: string) => `${mode}::${text}::${targetLang}`;

    if (isAppend) {
      return this.translateAppend(chunks, cacheKey, targetLang, onProgress);
    } else {
      return this.translateReplace(chunks, cacheKey, targetLang, onProgress);
    }
  }

  /** Append mode: chunk-level translation + inject below original */
  private async translateAppend(
    chunks: TextChunk[],
    cacheKey: (text: string) => string,
    targetLang: string,
    onProgress?: (phase: 'extract' | 'translate' | 'apply' | 'done') => void,
  ): Promise<void> {
    const cached: { chunk: TextChunk; translated: string }[] = [];
    const uncached: TextChunk[] = [];
    for (const c of chunks) {
      const hit = this.cache.get(cacheKey(c.text));
      if (hit) cached.push({ chunk: c, translated: hit });
      else uncached.push(c);
    }

    if (uncached.length === 0) {
      injectTranslations(cached.map(({ chunk, translated }) => ({ chunk, translatedText: translated })));
      onProgress?.('done');
      return;
    }

    onProgress?.('translate');
    this.startKeepalive();

    const sendList = uncached.map((c) => ({ text: c.text, meta: { chunk: c } }));
    const appendEntries: { chunk: TextChunk; translatedText: string }[] =
      cached.map(({ chunk, translated }) => ({ chunk, translatedText: translated }));

    await this.dispatchBatches(sendList, cacheKey, targetLang, (translated, meta) => {
      appendEntries.push({ chunk: meta.chunk, translatedText: translated });
    });

    this.stopKeepalive();
    if (this.cancelled) return;

    onProgress?.('apply');
    injectTranslations(appendEntries.filter((e) => e.translatedText));
    onProgress?.('done');
  }

  /** Replace mode: chunk-level with <a> tags. Parse tags in result to split translation
   *  across nodes — each node gets its corresponding segment.
   *  Link text comes directly from Google's <a> tag content (in-context translation). */
  private async translateReplace(
    chunks: TextChunk[],
    cacheKey: (text: string) => string,
    targetLang: string,
    onProgress?: (phase: 'extract' | 'translate' | 'apply' | 'done') => void,
  ): Promise<void> {
    const cached: { chunk: TextChunk; translated: string }[] = [];
    const uncached: TextChunk[] = [];
    for (const c of chunks) {
      const key = cacheKey(buildHtmlText(c));
      const hit = this.cache.get(key);
      if (hit) cached.push({ chunk: c, translated: hit });
      else uncached.push(c);
    }

    // Pre-translate link words as fallback for when Google mangles <a> tags
    const wordFallback = new Map<string, string>();
    const allLinkWords = [...new Set(chunks.flatMap(extractLinkWords))];
    if (allLinkWords.length > 0) {
      const wr = await browser.runtime.sendMessage({
        type: 'TRANSLATE_REQUEST', texts: allLinkWords,
        sourceLang: 'auto', targetLang, engine: 'google',
      }).catch(() => null) as TranslateResponseMsg | null;
      if (wr?.translations) {
        for (let i = 0; i < allLinkWords.length; i++) {
          wordFallback.set(allLinkWords[i], wr.translations[i]?.translated || allLinkWords[i]);
        }
      }
    }

    // Apply cached chunks immediately
    for (const { chunk, translated } of cached) {
      applyChunkWithATags(chunk, translated, wordFallback);
    }

    if (uncached.length === 0) {
      onProgress?.('done');
      return;
    }

    onProgress?.('translate');
    this.startKeepalive();

    const sendList = uncached.map((c) => ({ text: buildHtmlText(c), meta: { chunk: c } }));

    await this.dispatchBatches(sendList, cacheKey, targetLang, (translated, meta) => {
      applyChunkWithATags(meta.chunk, translated, wordFallback);
    });

    this.stopKeepalive();
    if (this.cancelled) return;

    onProgress?.('apply');
    onProgress?.('done');
  }

  /** Send texts to API in concurrent batches, calling onResult for each item */
  private async dispatchBatches(
    sendList: { text: string; meta: any }[],
    cacheKey: (text: string) => string,
    targetLang: string,
    onResult: (translated: string, meta: any) => void,
  ): Promise<void> {
    const batchList: { batch: typeof sendList; index: number }[] = [];
    for (let i = 0; i < sendList.length && !this.cancelled; i += CONCURRENT_BATCH_SIZE) {
      batchList.push({ batch: sendList.slice(i, i + CONCURRENT_BATCH_SIZE), index: i });
    }

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
            if (translated) onResult(translated, batch[j].meta);
          }
        } catch (err) {
          console.warn(`[TranslationEngine] Batch ${n} failed:`, err);
        }
      }),
    );
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

// ── <a> tag helpers (replace mode) ──

/** Wrap <a> text in actual <a> tags. Google preserves them (verified 11/11). */
function buildHtmlText(chunk: TextChunk): string {
  return chunk.nodes
    .map((n) => {
      const t = n.textContent || '';
      if (!t.trim()) return t;
      return n.parentElement?.closest('a') ? `<a>${t.trim()}</a>` : t;
    })
    .join('');
}

/** Parse translated text into typed segments. Each segment knows whether it
 *  came from inside an <a> tag (link) or between tags (text). */
function parseTypedSegments(text: string): { isLink: boolean; text: string }[] {
  const segments: { isLink: boolean; text: string }[] = [];
  const re = /<a>(.+?)<\/a>/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    segments.push({ isLink: false, text: text.slice(lastIndex, m.index) });
    segments.push({ isLink: true, text: m[1] });
    lastIndex = m.index + m[0].length;
  }
  segments.push({ isLink: false, text: text.slice(lastIndex) });
  return segments;
}

/** Distribute typed segments across chunk nodes by matching type (link→link, text→text).
 *  Falls back to wordFallback for link nodes Google's <a> restructuring drops. */
function applyChunkWithATags(
  chunk: TextChunk,
  translated: string,
  wordFallback: Map<string, string>,
): void {
  const segments = parseTypedSegments(translated);
  const nodes = chunk.nodes.filter((n) => isReplaceable(n as Text));

  let segIdx = 0;
  for (const node of nodes) {
    const wantLink = !!node.parentElement?.closest('a');
    while (segIdx < segments.length && segments[segIdx].isLink !== wantLink) {
      segIdx++;
    }
    if (segIdx < segments.length) {
      const text = segments[segIdx].text.trim();
      replaceTextNodes([{ node: node as Text, translatedText: text }]);
      segIdx++;
    } else if (wantLink) {
      // Google mangled this <a> tag — use individually translated fallback
      const original = node.textContent?.trim() || '';
      const fallback = wordFallback.get(original) || original;
      replaceTextNodes([{ node: node as Text, translatedText: fallback }]);
    } else {
      replaceTextNodes([{ node: node as Text, translatedText: '' }]);
    }
  }
}

// ── helpers ──

/** Extract link text from chunk nodes (for wordFallback when Google mangles <a>) */
function extractLinkWords(chunk: TextChunk): string[] {
  const words: string[] = [];
  for (const n of chunk.nodes) {
    if (n.parentElement?.closest('a') && n.textContent?.trim()) {
      words.push(n.textContent.trim());
    }
  }
  return words;
}

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
