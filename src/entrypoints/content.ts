/// <reference types="wxt" />
import { restoreTranslations } from '@/lib/dom/injector';
import { restoreTextNodes } from '@/lib/dom/replacer';
import { FloatingBall } from '@/lib/dom/floating-ball';
import { detectPageLanguage } from '@/lib/dom/language-detect';
import { TopBar } from '@/lib/dom/top-bar';
import { ContentObserver } from '@/lib/dom/observer';
import { TranslationEngine, type TranslationMode } from '@/lib/translation/engine';
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

    const settings = await browser.storage.local.get(['targetLang', 'translationMode']);
    if (settings.targetLang) targetLang = settings.targetLang as string;
    if (settings.translationMode) mode = settings.translationMode as TranslationMode;

    engine = new TranslationEngine({ mode, targetLang });

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
      browser.storage.local.set({ translationMode: mode });
      ball.setModeMenuLabel(mode);
      engine.setMode(mode);
      if (isTranslated) { restore(); doTranslate(); }
    });

    // Top bar
    const topBar = new TopBar();
    topBar.onTranslate(() => doTranslate());
    topBar.onNeverTranslate(() => rememberNeverTranslate());
    const neverSites = await getNeverTranslate();
    if (!neverSites.includes(location.hostname)) {
      const lang = detectPageLanguage(document);
      if (lang && lang !== 'zh') topBar.show(lang);
    }

    // Observer: re-translate when new content appears (SPA nav, infinite scroll)
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

async function getNeverTranslate(): Promise<string[]> {
  return (await browser.storage.local.get('neverTranslate')).neverTranslate as string[] || [];
}

async function rememberNeverTranslate(): Promise<void> {
  const sites = await getNeverTranslate();
  if (!sites.includes(location.hostname)) {
    sites.push(location.hostname);
    await browser.storage.local.set({ neverTranslate: sites });
  }
}
