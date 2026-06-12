/**
 * 消息类型定义 — Content Script ↔ Background Worker 通信协议。
 */

import type { TranslationEngine } from './translator/types';

// ── Popup → Content Script ──

export interface PopupTranslateMsg {
  type: 'TRANSLATE';
}

export interface PopupRestoreMsg {
  type: 'RESTORE';
}

export type PopupMessage = PopupTranslateMsg | PopupRestoreMsg;

// ── Content Script → Background ──

export interface DetectLangRequestMsg {
  type: 'DETECT_LANG_REQUEST';
}

export interface TranslateRequestMsg {
  type: 'TRANSLATE_REQUEST';
  texts: string[];
  sourceLang: string;
  targetLang: string;
  engine: TranslationEngine;
}

export type ContentMessage = TranslateRequestMsg | DetectLangRequestMsg;

// ── Background → Content Script ──

export interface DetectLangResponseMsg {
  type: 'DETECT_LANG_RESPONSE';
  lang: string | null;
}

export interface TranslateResponseMsg {
  type: 'TRANSLATE_RESPONSE';
  translations: Array<{ original: string; translated: string }>;
  engine: TranslationEngine;
  error?: string;
}

export type BackgroundMessage = TranslateResponseMsg | DetectLangResponseMsg;
