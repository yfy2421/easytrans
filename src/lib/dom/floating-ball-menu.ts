/**
 * 悬浮球菜单 — 右键菜单的创建、方向切换、边界修正。
 *
 * 从 floating-ball.ts 中提取，FloatingBall 通过 MenuCallbacks 委托。
 */

export interface MenuCallbacks {
  onTranslate: () => void;
  onRestore: () => void;
  onModeToggle: () => void;
  onSettings: () => void;
}

const DIRECTION_CLASSES = {
  left: 'bianyi-menu--left',
  right: 'bianyi-menu--right',
  up: 'bianyi-menu--up',
  down: 'bianyi-menu--down',
} as const;

export class BallMenu {
  private doc: Document;
  private el: HTMLElement;
  private callbacks: MenuCallbacks;
  visible = false;

  constructor(doc: Document, callbacks: MenuCallbacks) {
    this.doc = doc;
    this.callbacks = callbacks;
    this.el = this.build();
  }

  /** Build and return the menu element (not yet attached to DOM) */
  private build(): HTMLElement {
    const menu = this.doc.createElement('div');
    menu.className = 'bianyi-menu';

    const items: Array<{ action: string; label: string; cb: () => void }> = [
      { action: 'translate', label: '翻译此页', cb: this.callbacks.onTranslate },
      { action: 'restore', label: '还原原文', cb: this.callbacks.onRestore },
      { action: 'mode', label: '模式：双语对照 ↻', cb: this.callbacks.onModeToggle },
      { action: 'settings', label: '设置', cb: this.callbacks.onSettings },
    ];

    for (const { action, label, cb } of items) {
      const btn = this.doc.createElement('button');
      btn.className = 'bianyi-menu-item';
      btn.textContent = label;
      btn.dataset.action = action;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        cb();
      });
      menu.appendChild(btn);
    }

    return menu;
  }

  /** Return the menu element for attachment to Shadow DOM */
  getElement(): HTMLElement {
    return this.el;
  }

  /** Toggle menu visibility and recalculate direction */
  toggle(x: number, y: number, vw: number, vh: number): void {
    this.visible = !this.visible;
    if (this.visible) {
      this.updateDirection(x, y, vw, vh);
      this.applyState();
      this.reposition(vw, vh);
    } else {
      this.applyState();
    }
  }

  hide(): void {
    this.visible = false;
    this.applyState();
  }

  /** Update the mode menu item label */
  setModeLabel(mode: 'append' | 'replace'): void {
    const item = this.el.querySelector('[data-action="mode"]');
    if (item) {
      item.textContent = mode === 'replace' ? '模式：原生替换' : '模式：双语对照';
    }
  }

  // ── private ──

  private applyState(): void {
    const base = 'bianyi-menu';
    this.el.className = this.visible ? `${base} bianyi-menu--visible` : base;
  }

  /** Position the menu relative to the ball — opens away from the nearest edge */
  private updateDirection(x: number, y: number, vw: number, vh: number): void {
    // Reset all directional classes
    this.el.style.left = '';
    this.el.style.right = '';
    this.el.style.top = '';
    this.el.style.bottom = '';

    if (x < vw / 2) {
      this.el.style.left = '44px';
    } else {
      this.el.style.right = '44px';
    }
    if (y < vh / 2) {
      this.el.style.top = '44px';
    } else {
      this.el.style.bottom = '44px';
    }
  }

  /** Post-display bounds check: flip if menu overflows viewport */
  private reposition(vw: number, vh: number): void {
    const r = this.el.getBoundingClientRect();
    if (r.left < 0) { this.el.style.left = ''; this.el.style.right = '44px'; }
    if (r.right > vw) { this.el.style.right = ''; this.el.style.left = '44px'; }
    if (r.top < 0) { this.el.style.top = ''; this.el.style.bottom = '44px'; }
    if (r.bottom > vh) { this.el.style.bottom = ''; this.el.style.top = '44px'; }
  }
}
