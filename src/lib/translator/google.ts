/**
 * Google 翻译适配器 — Web 版端点（format=html），能正确保留 <a> 标签。
 *
 * 使用 Google 翻译 Web 版 API:
 * translate.googleapis.com/translate_a/t?format=html
 *
 * 来自沉浸式翻译的端点方案。
 */
import type {
  ITranslationAdapter,
  TranslationEngine,
  TranslationRequest,
  TranslationResponse,
  TranslationEngineConfig,
} from './types';
import { calcHash } from './google-tk';

const GOOGLE_API = 'https://translate.googleapis.com/translate_a/t?anno=3&client=te&v=1.0&format=html';

export class GoogleAdapter implements ITranslationAdapter {
  readonly engine: TranslationEngine = 'google';

  validate(config: TranslationEngineConfig): boolean {
    return config.type === 'google';
  }

  async translate(req: TranslationRequest): Promise<TranslationResponse> {
    const start = performance.now();

    const tk = calcHash(req.text);
    const body = `&sl=${req.sourceLang}&tl=${req.targetLang}&tk=${tk}&q=${encodeURIComponent(req.text)}`;

    const response = await fetch(GOOGLE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

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

  /** Parse Google's HTML-format response. Handles three response shapes:
   *  - string: "<pre>text</pre>"
   *  - string[]: ["<pre>text</pre>", ...]
   *  - [string, string][]: [["<pre>text</pre>", "detectedLang"], ...] */
  private parseResponse(data: unknown): string {
    let text: string;
    if (typeof data === 'string') {
      text = data;
    } else if (Array.isArray(data)) {
      const first = data[0];
      if (typeof first === 'string') {
        text = first;
      } else if (Array.isArray(first) && typeof first[0] === 'string') {
        text = first[0];
      } else {
        throw new Error('Unexpected Google Translate response format');
      }
    } else {
      throw new Error('Unexpected Google Translate response format');
    }

    // Strip <pre> wrapper — keep all other HTML (<a> tags etc.) for the engine
    text = text.replace(/<\/pre>/gi, '');
    const preStart = text.indexOf('<pre');
    if (preStart !== -1) {
      text = text.slice(text.indexOf('>', preStart) + 1);
    }

    return text;
  }
}
