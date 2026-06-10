/**
 * 翻译请求处理器 — Background Worker 核心逻辑。
 *
 * 与浏览器 API 解耦，方便单元测试。
 */

import type { TranslateRequestMsg, TranslateResponseMsg } from '../messages';
import type { ITranslationAdapter, TranslationEngineConfig } from './types';

/**
 * Process a batch of texts through the given adapter.
 * Each text is translated independently; partial failures are collected
 * and reported in the response.
 */
export async function handleTranslateRequest(
  msg: TranslateRequestMsg,
  adapter: ITranslationAdapter,
): Promise<TranslateResponseMsg> {
  const sourceLang = msg.sourceLang || 'auto';
  const config: TranslationEngineConfig = { type: adapter.engine };
  const translations: Array<{ original: string; translated: string }> = [];
  const errors: string[] = [];

  // Translate all texts in parallel (limited concurrency)
  const CONCURRENCY = 10;
  for (let i = 0; i < msg.texts.length; i += CONCURRENCY) {
    const batch = msg.texts.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((text) =>
        adapter.translate(
          { text, sourceLang, targetLang: msg.targetLang, engine: msg.engine },
          config,
        ),
      ),
    );
    for (let j = 0; j < batch.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') {
        translations.push({ original: batch[j], translated: result.value.translatedText });
      } else {
        errors.push((result.reason as Error).message);
      }
    }
  }

  const response: TranslateResponseMsg = {
    type: 'TRANSLATE_RESPONSE',
    translations,
    engine: msg.engine,
  };

  if (errors.length > 0) {
    response.error = `${errors.length}/${msg.texts.length} translations failed: ${errors.join('; ')}`;
  }

  return response;
}
