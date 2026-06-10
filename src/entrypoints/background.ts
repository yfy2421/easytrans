/// <reference types="wxt" />
import { handleTranslateRequest } from '@/lib/translator/handler';
import { GoogleAdapter } from '@/lib/translator/google';
import type { TranslateRequestMsg, TranslateResponseMsg } from '@/lib/messages';

const googleAdapter = new GoogleAdapter();

export default defineBackground({
  main() {
    console.log('[便捷翻译] Background worker started');

    browser.runtime.onMessage.addListener(
      (
        msg: TranslateRequestMsg,
        _sender,
        sendResponse: (response: TranslateResponseMsg) => void,
      ) => {
        if (msg.type === 'PING') {
          sendResponse({ type: 'TRANSLATE_RESPONSE', translations: [], engine: 'google' });
          return false;
        }
        if (msg.type === 'TRANSLATE_REQUEST') {
          handleTranslateRequest(msg, googleAdapter)
            .then(sendResponse)
            .catch((err) => sendResponse({
              type: 'TRANSLATE_RESPONSE',
              translations: [],
              engine: msg.engine,
              error: (err as Error).message,
            }));
          return true; // Keep the message channel open for async response
        }
        return false;
      },
    );
  },
});
