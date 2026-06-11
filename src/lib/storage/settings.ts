/**
 * 存储层 — 所有 chrome.storage.local 读写的唯一入口。
 *
 * 之前散落在 content.ts / options.vue / floating-ball.ts 中，
 * 现在集中管理，方便测试和以后迁移到其他存储后端。
 */
import type { TranslationEngine } from '@/lib/translator/types';

// ── Types ──

export interface UserSettings {
  targetLang: string;
  translationMode: 'append' | 'replace';
  translationEngine: TranslationEngine;
  neverTranslate: string[];
  ballPosition: { x: number; y: number } | null;
}

const DEFAULTS: UserSettings = {
  targetLang: 'zh',
  translationMode: 'append',
  translationEngine: 'google',
  neverTranslate: [],
  ballPosition: null,
};

// ── Generic get/set ──

export async function getSettings(): Promise<UserSettings> {
  const data = await browser.storage.local.get([
    'targetLang',
    'translationMode',
    'translationEngine',
    'neverTranslate',
    'ballPosition',
  ]);
  return {
    targetLang: (data.targetLang as string) || DEFAULTS.targetLang,
    translationMode: (data.translationMode as 'append' | 'replace') || DEFAULTS.translationMode,
    translationEngine: (data.translationEngine as TranslationEngine) || DEFAULTS.translationEngine,
    neverTranslate: (data.neverTranslate as string[]) || DEFAULTS.neverTranslate,
    ballPosition: (data.ballPosition as { x: number; y: number } | null) || DEFAULTS.ballPosition,
  };
}

export async function setSetting<K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K],
): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

// ── Never-translate helpers ──

export async function getNeverTranslate(): Promise<string[]> {
  const data = await browser.storage.local.get('neverTranslate');
  return (data.neverTranslate as string[]) || [];
}

export async function addNeverTranslate(hostname: string): Promise<string[]> {
  const sites = await getNeverTranslate();
  if (!sites.includes(hostname)) {
    sites.push(hostname);
    await browser.storage.local.set({ neverTranslate: sites });
  }
  return sites;
}

// ── Ball position ──

export async function getBallPosition(): Promise<{ x: number; y: number } | null> {
  const data = await browser.storage.local.get('ballPosition');
  return (data.ballPosition as { x: number; y: number } | null) || null;
}

export function setBallPosition(x: number, y: number): void {
  browser.storage.local.set({ ballPosition: { x, y } }).catch(() => {
    // Silently ignore if storage is unavailable (e.g. incognito)
  });
}
