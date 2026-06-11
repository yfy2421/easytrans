/// <reference types="wxt" />
import { handleTranslateRequest } from '@/lib/translator/handler';
import { GoogleAdapter } from '@/lib/translator/google';
import { registerAdapter, getAdapter, getDefaultEngine } from '@/lib/translator/dispatcher';
import type { TranslateRequestMsg, TranslateResponseMsg } from '@/lib/messages';

// ── Register available adapters (add new engines here) ──
registerAdapter(new GoogleAdapter());

export default defineBackground({
  main() {
    const defaultEngine = getDefaultEngine();
    console.log(`[便捷翻译] Background worker started, default engine: ${defaultEngine}`);

    browser.runtime.onMessage.addListener(
      (
        msg: TranslateRequestMsg,
        _sender,
        sendResponse: (response: TranslateResponseMsg) => void,
      ) => {
        if (msg.type === 'PING') {
          sendResponse({ type: 'TRANSLATE_RESPONSE', translations: [], engine: defaultEngine });
          return false;
        }

        if (msg.type === 'TRANSLATE_REQUEST') {
          const adapter = getAdapter(msg.engine);
          if (!adapter) {
            sendResponse({
              type: 'TRANSLATE_RESPONSE',
              translations: [],
              engine: msg.engine,
              error: `Unknown engine: ${msg.engine}`,
            });
            return false;
          }

          handleTranslateRequest(msg, adapter)
            .then(sendResponse)
            .catch((err) => sendResponse({
              type: 'TRANSLATE_RESPONSE',
              translations: [],
              engine: msg.engine,
              error: (err as Error).message,
            }));
          return true;
        }

        return false;
      },
    );
  },
});
