/**
 * 悬浮球 — Content Script 注入的页面内翻译入口。
 *
 * - 单击 = 一键翻译
 * - 右键 = 打开迷你菜单
 * - 可拖拽调整位置
 * - Shadow DOM 隔离样式
 */

const BALL_ID = 'bianyi-floating-ball';
const DRAG_THRESHOLD = 5; // px, minimal movement before counting as drag

const STYLES = `
  :host {
    all: initial;
    position: fixed;
    z-index: 2147483647;
  }
  .bianyi-ball {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #4f46e5;
    color: #fff;
    border: none;
    cursor: grab;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    user-select: none;
    transition: transform 0.15s;
  }
  .bianyi-ball:active {
    cursor: grabbing;
    transform: scale(1.15);
  }
  .bianyi-ball:hover {
    transform: scale(1.1);
  }
  .bianyi-menu {
    display: none;
    position: absolute;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    overflow: hidden;
    min-width: 120px;
  }
  .bianyi-menu--visible {
    display: block;
  }
  .bianyi-menu--left { right: 0; }
  .bianyi-menu--right { left: 0; }
  .bianyi-menu--up { bottom: 48px; }
  .bianyi-menu--down { top: 48px; }
  .bianyi-menu-item {
    display: block;
    width: 100%;
    padding: 8px 14px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 13px;
    text-align: left;
    color: #333;
    white-space: nowrap;
  }
  .bianyi-menu-item:hover {
    background: #f3f4f6;
  }
`;

type BallCallback = () => void;

export class FloatingBall {
  private container: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private x = 0;
  private y = 0;
  private menuVisible = false;
  private translateCb: BallCallback | null = null;
  private restoreCb: BallCallback | null = null;
  private settingsCb: BallCallback | null = null;
  private modeToggleCb: BallCallback | null = null;
  private doc: Document;

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private ballStartX = 0;
  private ballStartY = 0;
  private hasMoved = false;

  constructor(doc: Document = document) {
    this.doc = doc;
  }

  mount(): void {
    if (this.container && this.container.isConnected) return;

    const existing = this.doc.getElementById(BALL_ID);
    if (existing) existing.remove();

    const container = this.doc.createElement('div');
    container.id = BALL_ID;
    this.container = container;

    const shadow = container.attachShadow({ mode: 'open' });
    this.shadow = shadow;

    const style = this.doc.createElement('style');
    style.textContent = STYLES;
    shadow.appendChild(style);

    const ballBtn = this.doc.createElement('button');
    ballBtn.className = 'bianyi-ball';
    ballBtn.textContent = '译';

    // Click → translate / restore toggle, or cancel
    ballBtn.addEventListener('click', () => {
      if (this.hasMoved) return;
      if (this._isTranslating) {
        this._cancelCb?.();
      } else if (this._isTranslated) {
        this.restoreCb?.();
      } else {
        this.translateCb?.();
      }
    });

    // Right-click → menu
    ballBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.toggleMenu();
    });

    // Drag: pointer events
    ballBtn.addEventListener('pointerdown', (e: PointerEvent) => {
      this.dragging = true;
      this.hasMoved = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.ballStartX = this.x;
      this.ballStartY = this.y;
      ballBtn.setPointerCapture(e.pointerId);
    });

    ballBtn.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        this.hasMoved = true;
      }
      this.setPosition(this.ballStartX + dx, this.ballStartY + dy);
    });

    ballBtn.addEventListener('pointerup', () => {
      this.dragging = false;
      if (this.hasMoved) this.snapToEdge();
    });

    ballBtn.addEventListener('pointerleave', () => {
      this.dragging = false;
      if (this.hasMoved) this.snapToEdge();
    });

    // Hover: unsnap from edge, show full ball
    ballBtn.addEventListener('mouseenter', () => this.unsnapForHover());
    ballBtn.addEventListener('mouseleave', () => this.resnapAfterHover());

    shadow.appendChild(ballBtn);

    const menu = this.createMenu();
    shadow.appendChild(menu);

    this.doc.addEventListener('click', () => this.hideMenu(), true);

    // Append to body; if body not yet parsed (document_start on large pages),
    // wait via rAF polling until available.
    this.appendToBody(container);
  }

  /** Append container to body; if body is null (document_start before <body> parsed),
   *  poll via rAF until it becomes available. */
  private appendToBody(container: HTMLElement): void {
    if (this.doc.body) {
      this.doc.body.appendChild(container);
      this.finalizePosition();
      return;
    }
    // Body not yet available — poll until parsed
    const tryAppend = () => {
      if (this.doc.body) {
        this.doc.body.appendChild(container);
        this.finalizePosition();
      } else {
        requestAnimationFrame(tryAppend);
      }
    };
    requestAnimationFrame(tryAppend);
  }

  private finalizePosition(): void {
    if (this.x === 0 && this.y === 0) {
      this.loadPosition();
    }
    this.applyPosition();
  }

  unmount(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadow = null;
    }
  }

  onTranslate(cb: BallCallback): void {
    this.translateCb = cb;
  }

  onRestore(cb: BallCallback): void {
    this.restoreCb = cb;
  }

  onSettings(cb: BallCallback): void {
    this.settingsCb = cb;
  }

  onModeToggle(cb: BallCallback): void {
    this.modeToggleCb = cb;
  }

  /** Update the mode menu item to reflect current mode */
  setModeMenuLabel(mode: 'append' | 'replace'): void {
    if (!this.shadow) return;
    const item = this.shadow.querySelector('[data-action="mode"]');
    if (item) {
      item.textContent = mode === 'replace' ? '模式：原生替换' : '模式：双语对照';
    }
  }

  /** Switch ball to "translating" state — click becomes cancel */
  setTranslating(active: boolean): void {
    if (!this.shadow) return;
    const ball = this.shadow.querySelector('.bianyi-ball') as HTMLElement;
    if (!ball) return;
    if (active) {
      ball.textContent = '✕';
      ball.style.background = '#ef4444';
      ball.title = '点击取消翻译';
      this._isTranslating = true;
    } else {
      ball.textContent = this._isTranslated ? '原' : '译';
      ball.style.background = '#4f46e5';
      ball.title = this._isTranslated ? '点击还原原文' : '点击翻译此页';
      this._isTranslating = false;
    }
  }

  private _isTranslating = false;
  private _isTranslated = false;
  private _isSnapped = false;
  private _hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private _cancelCb: BallCallback | null = null;

  onCancel(cb: BallCallback): void {
    this._cancelCb = cb;
  }

  /** Track translation state for one-click toggle */
  setTranslated(active: boolean): void {
    this._isTranslated = active;
    if (!this.shadow || this._isTranslating) return;
    const ball = this.shadow.querySelector('.bianyi-ball') as HTMLElement;
    if (!ball) return;
    ball.textContent = active ? '原' : '译';
    ball.title = active ? '点击还原原文' : '点击翻译此页';
  }

  setPosition(x: number, y: number): void {
    const vw = this.doc.defaultView?.innerWidth || 1024;
    const vh = this.doc.defaultView?.innerHeight || 768;
    // Allow part of ball to go off-screen for edge snap feel
    this.x = Math.max(-20, Math.min(x, vw - 20));
    this.y = Math.max(-20, Math.min(y, vh - 20));
    this.applyPosition();
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  // ── private ──

  private loadPosition(): void {
    const vw = this.doc.defaultView?.innerWidth || 1024;
    const vh = this.doc.defaultView?.innerHeight || 768;
    this.x = vw - 56;
    this.y = vh - 56;
  }

  private savePosition(): void {
    // Persist to storage (non-blocking)
    try {
      browser?.storage?.local?.set({ ballPosition: { x: this.x, y: this.y } });
    } catch {
      // Silently ignore if storage is unavailable
    }
  }

  private applyPosition(): void {
    if (!this.container) return;
    this.container.style.left = `${this.x}px`;
    this.container.style.top = `${this.y}px`;
  }

  private createMenu(): HTMLElement {
    const menu = this.doc.createElement('div');
    menu.className = 'bianyi-menu';

    const items = [
      { action: 'translate', label: '翻译此页', cb: () => this.translateCb?.() },
      { action: 'restore', label: '还原原文', cb: () => this.restoreCb?.() },
      { action: 'mode', label: '模式：双语对照 ↻', cb: () => this.modeToggleCb?.() },
      { action: 'settings', label: '设置', cb: () => this.settingsCb?.() },
    ];

    for (const { action, label, cb } of items) {
      const btn = this.doc.createElement('button');
      btn.className = 'bianyi-menu-item';
      btn.textContent = label;
      btn.dataset.action = action;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideMenu();
        cb?.();
      });
      menu.appendChild(btn);
    }

    return menu;
  }

  private toggleMenu(): void {
    if (!this.shadow) return;
    this.menuVisible = !this.menuVisible;
    if (this.menuVisible) {
      this.updateMenuDirection();
      this.applyMenuState(); // show first so getBoundingClientRect works
      this.repositionMenu(); // then check bounds
    } else {
      this.applyMenuState();
    }
  }

  private hideMenu(): void {
    if (!this.shadow) return;
    this.menuVisible = false;
    this.applyMenuState();
  }

  private snapToEdge(): void {
    const vw = this.doc.defaultView?.innerWidth || 1024;
    const vh = this.doc.defaultView?.innerHeight || 768;
    const SNAP = 60;
    const SHOW = 28;

    this._isSnapped = false;
    if (this.x < SNAP) { this.x = -(40 - SHOW); this._isSnapped = true; }
    else if (this.x > vw - 40 - SNAP) { this.x = vw - SHOW; this._isSnapped = true; }

    if (this.y < SNAP) { this.y = -(40 - SHOW); this._isSnapped = true; }
    else if (this.y > vh - 40 - SNAP) { this.y = vh - SHOW; this._isSnapped = true; }

    // Clamp: never hide more than ⅔ of the ball (prevent disappearing)
    this.x = Math.max(-24, Math.min(this.x, vw - 16));
    this.y = Math.max(-24, Math.min(this.y, vh - 16));

    this.applyPosition();
    this.updateOpacity();
    this.updateMenuDirection();
    this.savePosition();
  }

  private unsnapForHover(): void {
    if (!this._isSnapped) return;
    if (this._hoverTimer) { clearTimeout(this._hoverTimer); this._hoverTimer = null; }
    const vw = this.doc.defaultView?.innerWidth || 1024;
    const vh = this.doc.defaultView?.innerHeight || 768;
    // Slide out so ball is fully visible
    if (this.x < 0) this.setPosition(8, this.y);
    else if (this.x > vw - 40) this.setPosition(vw - 48, this.y);
    if (this.y < 0) this.setPosition(this.x, 8);
    else if (this.y > vh - 40) this.setPosition(this.x, vh - 48);
    this.updateOpacity();
  }

  private resnapAfterHover(): void {
    if (!this._isSnapped) return;
    this._hoverTimer = setTimeout(() => {
      this.snapToEdge();
    }, 800);
  }

  private updateOpacity(): void {
    if (!this.shadow) return;
    const vw = this.doc.defaultView?.innerWidth || 1024;
    const vh = this.doc.defaultView?.innerHeight || 768;
    const ball = this.shadow.querySelector('.bianyi-ball') as HTMLElement;
    if (!ball) return;

    const nearEdge =
      this.x < 30 || this.x > vw - 70 || this.y < 30 || this.y > vh - 70;
    ball.style.opacity = (nearEdge && this._isSnapped) ? '0.5' : '1';
    ball.style.transition = 'opacity 0.3s';
  }

  private updateMenuDirection(): void {
    if (!this.shadow) return;
    const menu = this.shadow.querySelector('.bianyi-menu') as HTMLElement;
    if (!menu) return;
    const vw = this.doc.defaultView?.innerWidth || 1024;
    const vh = this.doc.defaultView?.innerHeight || 768;

    // Menu opens from the OPPOSITE side of the ball:
    // Ball on left half → menu extends rightward from ball's RIGHT edge
    // Ball on right half → menu extends leftward from ball's LEFT edge
    menu.style.left = '';
    menu.style.right = '';
    menu.style.top = '';
    menu.style.bottom = '';

    if (this.x < vw / 2) {
      menu.style.left = '44px';  // ball width + gap, menu starts after ball
    } else {
      menu.style.right = '44px'; // menu ends before ball's left edge
    }

    if (this.y < vh / 2) {
      menu.style.top = '44px';   // menu below ball
    } else {
      menu.style.bottom = '44px'; // menu above ball
    }
  }

  private repositionMenu(): void {
    if (!this.shadow) return;
    const menu = this.shadow.querySelector('.bianyi-menu') as HTMLElement;
    if (!menu) return;

    const r = menu.getBoundingClientRect();
    const vw = this.doc.defaultView?.innerWidth || 1024;
    const vh = this.doc.defaultView?.innerHeight || 768;

    if (r.left < 0) { menu.style.left = ''; menu.style.right = '44px'; }
    if (r.right > vw) { menu.style.right = ''; menu.style.left = '44px'; }
    if (r.top < 0) { menu.style.top = ''; menu.style.bottom = '44px'; }
    if (r.bottom > vh) { menu.style.bottom = ''; menu.style.top = '44px'; }
  }

  private applyMenuState(): void {
    const menu = this.shadow!.querySelector('.bianyi-menu');
    if (!menu) return;
    const base = 'bianyi-menu';
    menu.className = this.menuVisible ? `${base} bianyi-menu--visible` : base;
  }
}
