/**
 * 页面语言检测 — 从 html[lang] 或文本内容推断页面语言。
 */

// High-frequency words per language (lowercase) for statistical detection
const LANG_MARKERS: Record<string, string[]> = {
  en: ['the', 'is', 'are', 'was', 'were', 'and', 'that', 'this', 'with', 'for', 'from', 'have', 'has', 'not', 'but', 'you', 'all', 'can', 'will', 'your'],
  zh: ['的', '是', '在', '了', '和', '不', '我', '有', '这', '人', '中', '大', '为', '上', '个', '们', '到', '说', '时', '要'],
  ja: ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ', 'る', 'す', 'ん', 'な', 'い', 'ま', 'か', 'も'],
  ko: ['이', '가', '은', '는', '을', '를', '에', '의', '로', '고', '다', '서', '도', '지', '게', '하', '기', '한', '있', '습'],
  fr: ['le', 'la', 'les', 'des', 'est', 'une', 'dans', 'pas', 'plus', 'sur', 'par', 'nous', 'vous', 'aux', 'ses', 'fait', 'leur', 'très', 'bien', 'avec'],
  de: ['der', 'die', 'das', 'ein', 'eine', 'und', 'ist', 'nicht', 'mit', 'auf', 'von', 'den', 'dem', 'des', 'war', 'wie', 'auch', 'bei', 'nach', 'über'],
  es: ['que', 'los', 'las', 'una', 'con', 'por', 'del', 'como', 'más', 'está', 'son', 'han', 'era', 'sus', 'ese', 'fue', 'ese', 'otro', 'hace', 'muy'],
  ru: ['что', 'это', 'как', 'так', 'для', 'все', 'его', 'она', 'они', 'был', 'быть', 'весь', 'год', 'мой', 'наш', 'или', 'если', 'уже', 'кто', 'даже'],
};

function countMatches(text: string, markers: string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const m of markers) {
    let idx = 0;
    while ((idx = lower.indexOf(m, idx)) !== -1) {
      count++;
      idx += m.length;
    }
  }
  return count;
}

/**
 * Detect page language from html[lang] attribute or text content analysis.
 * Returns ISO 639-1 code or null if detection fails.
 */
export function detectPageLanguage(doc: Document): string | null {
  const htmlEl = doc.documentElement;

  // Priority 1: html[lang] attribute
  const lang = htmlEl.getAttribute('lang')?.toLowerCase();
  if (lang && lang.length >= 2) {
    return lang.slice(0, 2);
  }

  // Priority 2: text content analysis (body may not exist at document_start)
  const bodyText = doc.body?.textContent || '';
  const text = bodyText.slice(0, 2000); // First 2000 chars is enough

  if (text.trim().length < 20) return null;

  let bestLang: string | null = null;
  let bestScore = 0;

  for (const [code, markers] of Object.entries(LANG_MARKERS)) {
    const score = countMatches(text, markers);
    if (score > bestScore) {
      bestScore = score;
      bestLang = code;
    }
  }

  // Require minimum confidence
  return bestScore >= 2 ? bestLang : null;
}
