/**
 * 页面语言检测 — 使用 Chrome 内置 CLD3 语言检测器
 * （跟 chrome.runtime.detectLanguage / 右键翻译同款引擎）。
 * 比手动统计字符密度准确得多，中文页面不会被误判为西班牙语。
 */

/**
 * Detect page language from html[lang] attribute or Chrome's built-in detector.
 * Returns ISO 639-1 code or null if detection fails.
 */
export async function detectPageLanguage(doc: Document): Promise<string | null> {
  const htmlEl = doc.documentElement;

  // Priority 1: html[lang] attribute (instant, no API call)
  const lang = htmlEl.getAttribute('lang')?.toLowerCase();
  if (lang && lang.length >= 2) {
    return lang.slice(0, 2);
  }

  // Priority 2: Chrome's built-in CLD3 model (callback-based API)
  try {
    const text = doc.body?.textContent?.slice(0, 2000) || '';
    if (text.trim().length < 20) return null;
    const result = await new Promise<{ languages: Array<{ language: string; percentage: number }> }>((resolve) => {
      chrome.i18n.detectLanguage(text, resolve);
    });
    if (result?.languages?.length > 0) {
      return result.languages[0].language;
    }
  } catch {
    // chrome.i18n unavailable — fall back to character density
    return detectByCharDensity(doc.body?.textContent?.slice(0, 2000) || '');
  }

  return null;
}

// ── Fallback: character-density analysis (for browsers without chrome.i18n, like Safari) ──

const CJK_CHAR_RE = /[一-鿿]/g;
const HIRAGANA_RE = /[぀-ゟ]/g;
const KATAKANA_RE = /[゠-ヿ]/g;
const HANGUL_RE = /[가-힯]/g;
const CYRILLIC_RE = /[Ѐ-ӿ]/g;

function detectByCharDensity(text: string): string | null {
  if (text.trim().length < 20) return null;
  const total = text.length;

  const cjk = text.match(CJK_CHAR_RE);
  if (cjk && cjk.length / total > 0.15) return 'zh';

  const hira = text.match(HIRAGANA_RE);
  const kata = text.match(KATAKANA_RE);
  const kanaRatio = (hira ? hira.length : 0) + (kata ? kata.length : 0);
  if (kanaRatio / total > 0.10) return 'ja';

  const hangul = text.match(HANGUL_RE);
  if (hangul && hangul.length / total > 0.10) return 'ko';

  const cyrillic = text.match(CYRILLIC_RE);
  if (cyrillic && cyrillic.length / total > 0.15) return 'ru';

  return null;
}
