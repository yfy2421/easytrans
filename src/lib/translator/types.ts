/**
 * 翻译引擎适配层 — 统一类型定义。
 *
 * 来自 ARCHITECTURE.md §3.1
 */

/** Supported translation engines */
export type TranslationEngine = 'google' | 'deepl' | 'openai' | 'claude' | 'ollama';

/** Input to a translation adapter */
export interface TranslationRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
  engine: TranslationEngine;
}

/** Output from a translation adapter */
export interface TranslationResponse {
  translatedText: string;
  engine: TranslationEngine;
  model?: string;
  latency: number; // ms
}

/** Configuration for a specific engine */
export interface TranslationEngineConfig {
  type: TranslationEngine;
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  options?: Record<string, unknown>;
}

/** Every translation engine must implement this */
export interface ITranslationAdapter {
  readonly engine: TranslationEngine;
  translate(
    req: TranslationRequest,
    config: TranslationEngineConfig,
  ): Promise<TranslationResponse>;
  validate(config: TranslationEngineConfig): boolean;
}
