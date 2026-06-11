/**
 * 规则引擎 — 根据当前 URL 匹配内置站点规则，返回可翻译元素选择器。
 */
import { BUILTIN_RULES, type SiteRule } from './builtin';

export interface MatchedRule {
  rule: SiteRule;
  /** CSS selector to scope translation (limit to this area) */
  containerSelector: string | null;
  /** CSS selectors for translatable content within the container */
  selectors: string[];
  /** CSS selectors to skip */
  noTranslateSelectors: string[];
  /** Visual style override */
  style?: string;
}

/**
 * Match site rules against a URL. Returns null if no rule matches.
 */
export function matchRule(url: string): MatchedRule | null {
  const urlObj = safeUrl(url);
  if (!urlObj) return null;

  const hostname = urlObj.hostname;

  for (const rule of BUILTIN_RULES) {
    // Hostname OR regex: if both specified, matching either is sufficient.
    let matched = false;

    if (rule.hostname) {
      const hosts = Array.isArray(rule.hostname) ? rule.hostname : [rule.hostname];
      if (hosts.some((h) => hostname === h || hostname.endsWith('.' + h))) matched = true;
    }
    if (rule.regex) {
      const regexes = Array.isArray(rule.regex) ? rule.regex : [rule.regex];
      if (regexes.some((r) => new RegExp(r).test(url))) matched = true;
    }
    if (!matched) continue;

    return {
      rule,
      containerSelector: normalizeContainer(rule.containerSelectors),
      selectors: rule.selectors ?? [],
      noTranslateSelectors: rule.noTranslateSelectors ?? [],
      style: rule.style,
    };
  }

  return null;
}

function safeUrl(url: string): URL | null {
  try { return new URL(url); } catch { return null; }
}

function normalizeContainer(sel: string | string[] | undefined): string | null {
  if (!sel) return null;
  return Array.isArray(sel) ? sel.join(', ') : sel;
}
