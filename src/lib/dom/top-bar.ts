/**
 * 顶部提示条 — 检测到外文页面时自动弹出翻译入口。
 *
 * 来自 ARCHITECTURE.md §2.4：
 * - 5 秒自动消失
 * - [翻译此页] [永不翻译此站] [✕]
 */

const BAR_ID = 'bianyi-top-bar';
const LANG_LABELS: Record<string, string> = {
  en: '英文',
  ja: '日文',
  ko: '韩文',
  fr: '法文',
  de: '德文',
  es: '西班牙文',
  ru: '俄文',
};

const STYLES = `
  :host {
    all: initial;
    display: block;
    position: sticky;
    top: 0;
    z-index: 2147483646;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    color: #fff;
    font-family: system-ui, sans-serif;
    font-size: 13px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  }
  .bar span {
    flex: 1;
  }
  .bar button {
    padding: 4px 12px;
    border: 1px solid rgba(255,255,255,0.5);
    border-radius: 4px;
    background: rgba(255,255,255,0.15);
    color: #fff;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
  }
  .bar button:hover {
    background: rgba(255,255,255,0.3);
  }
  .bar .btn-close {
    border: none;
    background: none;
    padding: 2px 6px;
    font-size: 16px;
    opacity: 0.7;
  }
`;

type BarCallback = () => void;

export class TopBar {
  private container: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private translateCb: BarCallback | null = null;
  private neverCb: BarCallback | null = null;
  private doc: Document;

  constructor(doc: Document = document) {
    this.doc = doc;
  }

  onTranslate(cb: BarCallback): void {
    this.translateCb = cb;
  }

  onNeverTranslate(cb: BarCallback): void {
    this.neverCb = cb;
  }

  show(lang: string | null): void {
    if (!lang) return;
    this.dismiss();

    const label = LANG_LABELS[lang] || lang.toUpperCase();

    const container = this.doc.createElement('div');
    container.id = BAR_ID;
    const shadow = container.attachShadow({ mode: 'open' });

    const style = this.doc.createElement('style');
    style.textContent = STYLES;
    shadow.appendChild(style);

    const bar = this.doc.createElement('div');
    bar.className = 'bar';

    const text = this.doc.createElement('span');
    text.textContent = `🌐 检测到${label}页面`;

    const translateBtn = this.doc.createElement('button');
    translateBtn.textContent = '翻译此页';
    translateBtn.dataset.action = 'translate';
    translateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.translateCb?.();
      this.dismiss();
    });

    const neverBtn = this.doc.createElement('button');
    neverBtn.textContent = '永不翻译此站';
    neverBtn.dataset.action = 'never';
    neverBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.neverCb?.();
      this.dismiss();
    });

    const closeBtn = this.doc.createElement('button');
    closeBtn.className = 'btn-close';
    closeBtn.textContent = '✕';
    closeBtn.dataset.action = 'close';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismiss();
    });

    bar.appendChild(text);
    bar.appendChild(translateBtn);
    bar.appendChild(neverBtn);
    bar.appendChild(closeBtn);
    shadow.appendChild(bar);

    if (this.doc.body) {
      this.doc.body.insertBefore(container, this.doc.body.firstChild);
    } else {
      // body not yet parsed (document_start on large pages)
      const tryInsert = () => {
        if (this.doc.body) {
          this.doc.body.insertBefore(container, this.doc.body.firstChild);
        } else {
          requestAnimationFrame(tryInsert);
        }
      };
      requestAnimationFrame(tryInsert);
    }
    this.container = container;

    // Auto dismiss after 5 seconds
    this.timer = setTimeout(() => this.dismiss(), 5000);
  }

  dismiss(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
