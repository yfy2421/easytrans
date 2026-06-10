/**
 * Google 翻译适配器 — 免费，无需 API Key。
 *
 * 使用 Google 翻译非官方 API:
 * translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh&dt=t&q=...
 *
 * 来自 ARCHITECTURE.md §3.2
 */

import type {
  ITranslationAdapter,
  TranslationEngine,
  TranslationRequest,
  TranslationResponse,
  TranslationEngineConfig,
} from './types';

const GOOGLE_API = 'https://translate.googleapis.com/translate_a/single';

export class GoogleAdapter implements ITranslationAdapter {
  readonly engine: TranslationEngine = 'google';

  validate(config: TranslationEngineConfig): boolean {
    return config.type === 'google';
  }

  async translate(req: TranslationRequest): Promise<TranslationResponse> {
    const start = performance.now();

    const params = new URLSearchParams({
      client: 'gtx',
      sl: req.sourceLang,
      tl: req.targetLang,
      dt: 't',
      q: req.text,
    });

    const response = await fetch(`${GOOGLE_API}?${params}`);

    if (!response.ok) {
      throw new Error(
        `Google translate returned ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json();
    const translatedText = this.parseResponse(data);
    const latency = Math.round(performance.now() - start);

    return {
      translatedText,
      engine: 'google',
      latency,
    };
  }

  /** Extract concatenated translation text from Google's nested array response */
  private parseResponse(data: unknown): string {
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      throw new Error('Unexpected Google Translate response format');
    }

    const segments = data[0] as unknown[];
    return segments
      .map((seg) => {
        if (Array.isArray(seg) && typeof seg[0] === 'string') {
          return seg[0] as string;
        }
        return '';
      })
      .join('');
  }
}
