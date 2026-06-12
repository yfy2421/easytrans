/// <reference types="wxt" />
import { restoreTranslations } from '@/lib/dom/injector';
import { restoreTextNodes } from '@/lib/dom/replacer';
import { FloatingBall } from '@/lib/dom/floating-ball';
import { detectPageLanguage } from '@/lib/dom/language-detect'; // fallback only
import { TopBar } from '@/lib/dom/top-bar';
import { ContentObserver } from '@/lib/dom/observer';
import { TranslationEngine, type TranslationMode } from '@/lib/translation/engine';
import { getSettings, getNeverTranslate, addNeverTranslate, setSetting } from '@/lib/storage/settings';
import type { PopupMessage } from '@/lib/messages';

let isTranslated = false;
let lastTranslateTime = 0;
const COOLDOWN = 3000;
let targetLang = 'zh';
let mode: TranslationMode = 'append';
let engine: TranslationEngine;
let ball: FloatingBall;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',

  async main() {
    console.log('[便捷翻译] Content script loaded');

    const settings = await getSettings();
    targetLang = settings.targetLang;
    mode = settings.translationMode;

    engine = new TranslationEngine({
      mode,
      targetLang,
      engine: settings.translationEngine,
    });

    // Floating ball
    ball = new FloatingBall();
    ball.mount();
    ball.onTranslate(() => doTranslate());
    ball.onRestore(() => restore());
    ball.onCancel(() => engine.cancel());
    ball.onSettings(() => chrome.runtime.openOptionsPage());
    ball.setModeMenuLabel(mode);
    ball.onModeToggle(() => {
      mode = mode === 'append' ? 'replace' : 'append';
      setSetting('translationMode', mode);
      ball.setModeMenuLabel(mode);
      engine.setMode(mode);
      if (isTranslated) { restore(); doTranslate(); }
    });

    // Top bar
    const topBar = new TopBar();
    topBar.onTranslate(() => doTranslate());
    topBar.onNeverTranslate(() => { addNeverTranslate(location.hostname); });
    const neverSites = await getNeverTranslate();
    if (!neverSites.includes(location.hostname)) {
      // Priority: browser tab-level detection (full page index, no DOM race)
      let lang: string | null = null;
      try {
        const resp = await browser.runtime.sendMessage({ type: 'DETECT_LANG_REQUEST' });
        lang = (resp as { lang: string | null }).lang;
      } catch {
        // Fallback to DOM-based detection
        lang = await detectPageLanguage(document);
      }
      // Skip if page is already in the user's target language
      if (lang && !isSameLanguage(lang, targetLang)) topBar.show(lang);
    }

    // Observer
    const observer = new ContentObserver(() => {
      if (isTranslated && Date.now() - lastTranslateTime > COOLDOWN) {
        doTranslate();
      }
    }, { debounceMs: 1000 });
    observer.start(document);

    // Popup messages
    browser.runtime.onMessage.addListener((msg: PopupMessage) => {
      if (msg.type === 'TRANSLATE') doTranslate();
      else if (msg.type === 'RESTORE') restore();
    });
  },
});

async function doTranslate(): Promise<void> {
  // Guard: don't translate if page is already in target language
  let pageLang: string | null = null;
  try {
    const resp = await browser.runtime.sendMessage({ type: 'DETECT_LANG_REQUEST' });
    pageLang = (resp as { lang: string | null }).lang;
  } catch { /* ignore */ }
  if (pageLang && isSameLanguage(pageLang, targetLang)) {
    ball.toast(langLabel(targetLang) + '页面，无需翻译');
    return;
  }

  lastTranslateTime = Date.now();
  ball.setTranslating(true);
  try {
    await engine.translate(document);
  } catch (err) {
    console.error('[便捷翻译] Failed:', err);
  }
  isTranslated = true;
  ball.setTranslated(true);
  ball.setTranslating(false);
}

function restore(): void {
  restoreTranslations();
  restoreTextNodes();
  isTranslated = false;
  ball.setTranslated(false);
}

/** Compare detected lang with target lang — e.g. "zh" ≈ "zh-CN" ≈ "zh-TW", "en" ≈ "en-US" */
function isSameLanguage(detected: string, target: string): boolean {
  return detected.slice(0, 2) === target.slice(0, 2);
}

function langLabel(code: string): string {
  const map: Record<string, string> = {
    zh: '中文', en: '英文', ja: '日文', ko: '韩文', fr: '法文', de: '德文', es: '西班牙文', ru: '俄文',
  };
  return map[code.slice(0, 2)] || code;
}
