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

export interface TranslateRequestMsg {
  type: 'TRANSLATE_REQUEST';
  texts: string[];
  sourceLang: string;
  targetLang: string;
  engine: TranslationEngine;
}

export type ContentMessage = TranslateRequestMsg;

// ── Background → Content Script ──

export interface TranslateResponseMsg {
  type: 'TRANSLATE_RESPONSE';
  translations: Array<{ original: string; translated: string }>;
  engine: TranslationEngine;
  error?: string;
}

export type BackgroundMessage = TranslateResponseMsg;
