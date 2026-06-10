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

    // TEMP: marker format comparison — run from popup or translate button
    const runMarkerTest = async () => {
      const word = 'nymph';
      const markers: Record<string, string> = {
        'bare_a':       `<a>${word}</a>`,
        'angle_num':    `⟨1⟩${word}⟨1⟩`,
        'at_pct_hash':  `@%1#$ ${word} @%1#$`,
        'reverse_k':    `kkkd${word}dkkk`,
        'double_brace': `{{1}}${word}{{1}}`,
        'dollar_num':   `$1$ ${word} $1$`,
      };
      const texts = Object.entries(markers).map(([name, marked]) => `Amalthea is described as a ${marked} who raises the child`);
      const names = Object.keys(markers);

      const r = await browser.runtime.sendMessage({
        type: 'TRANSLATE_REQUEST', texts,
        sourceLang: 'en', targetLang: 'zh', engine: 'google',
      });

      for (let i = 0; i < names.length; i++) {
        const out = r.translations[i]?.translated || '';
        const intact = out.includes(word) || out.includes('仙女');
        console.log(`${names[i].padEnd(14)} IN:  ${markers[names[i]]}`);
        console.log(' '.repeat(14) + `OUT: ${out}`);
        console.log(' '.repeat(14) + `     ${intact ? '✅ intact' : '❌ broken'}`);
        console.log('');
      }
    };
    // Test <a> tag preservation on real content (run once after page load)
    const runATagTest = () => {
      const paras = Array.from(document.querySelectorAll('p')).filter(
        (p) => p.querySelector('a') && (p.textContent?.length ?? 0) > 100,
      );
      if (paras.length === 0) return;
      const p = paras[0];
      const parts: string[] = [];
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const t = node.textContent || '';
        if (!t.trim()) continue;
        parts.push(node.parentElement?.closest('a') ? `<a>${t.trim()}</a>` : t);
      }
      const htmlText = parts.join('');
      browser.runtime.sendMessage({
        type: 'TRANSLATE_REQUEST', texts: [htmlText],
        sourceLang: 'en', targetLang: 'zh', engine: 'google',
      }).then((r: any) => {
        const out = r.translations[0]?.translated || '';
        console.log('[<a> test] IN: ', htmlText.slice(0, 250));
        console.log('[<a> test] OUT:', out.slice(0, 350));
        const inC = (htmlText.match(/<a>/g) || []).length;
        const outC = (out.match(/<a>/g) || []).length;
        console.log(`[<a> test] <a> tags: ${inC}→${outC} ${inC === outC ? '✅ ALL PRESERVED' : '❌ MISMATCH'}`);
      }).catch((e: any) => console.error('[<a> test] Failed:', e));
    };
    setTimeout(runATagTest, 2000);

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
    ball.onSettings(() => browser.runtime.openOptionsPage());
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
  ball.setTranslating(true);
  try {
    await engine.translate(document);
  } catch (err) {
    console.error('[便捷翻译] Failed:', err);
  }
  isTranslated = true;
  lastTranslateTime = Date.now();
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
