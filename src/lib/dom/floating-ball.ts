/**
 * 悬浮球 — Content Script 注入的页面内翻译入口。
 *
 * - 单击 = 一键翻译/还原/取消
 * - 右键 = 打开迷你菜单
 * - 可拖拽调整位置
 * - Shadow DOM 隔离样式
 */
import { setBallPosition } from '@/lib/storage/settings';
import { BALL_STYLES } from './floating-ball-styles';
import { BallMenu, type MenuCallbacks } from './floating-ball-menu';

const BALL_ID = 'bianyi-floating-ball';

// ── drag / snap constants ──
const DRAG_THRESHOLD = 5;   // px before counting as drag (vs click)
const SNAP_DISTANCE = 60;   // px from edge to trigger snap
const SNAP_SHOW = 28;       // px of ball visible when snapped
const SNAP_CLAMP_MIN = -24; // never hide more than ⅔ of ball
const SNAP_CLAMP_MAX = 16;  // at least 16px visible
const HOVER_RESNAP_MS = 800;

type BallCallback = () => void;

export class FloatingBall {
  private container: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private ballBtn: HTMLElement | null = null;
  private menu: BallMenu;
  private x = 0;
  private y = 0;
  private doc: Document;

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private ballStartX = 0;
  private ballStartY = 0;
  private hasMoved = false;

  // UI state
  private _isTranslating = false;
  private _isTranslated = false;
  private _isSnapped = false;
  private _hoverTimer: ReturnType<typeof setTimeout> | null = null;

  // Callbacks
  private translateCb: BallCallback | null = null;
  private restoreCb: BallCallback | null = null;
  private settingsCb: BallCallback | null = null;
  private modeToggleCb: BallCallback | null = null;
  private _cancelCb: BallCallback | null = null;

  constructor(doc: Document = document) {
    this.doc = doc;
    this.menu = new BallMenu(doc, {
      onTranslate: () => this.translateCb?.(),
      onRestore: () => this.restoreCb?.(),
      onModeToggle: () => this.modeToggleCb?.(),
      onSettings: () => this.settingsCb?.(),
    });
  }

  // ── lifecycle ──

  mount(): void {
    if (this.container?.isConnected) return;

    const existing = this.doc.getElementById(BALL_ID);
    if (existing) existing.remove();

    const container = this.doc.createElement('div');
    container.id = BALL_ID;
    this.container = container;

    const shadow = container.attachShadow({ mode: 'open' });
    this.shadow = shadow;

    const style = this.doc.createElement('style');
    style.textContent = BALL_STYLES;
    shadow.appendChild(style);

    const ballBtn = this.doc.createElement('button');
    ballBtn.className = 'bianyi-ball';
    ballBtn.textContent = '译';
    this.ballBtn = ballBtn;
    this.bindEvents(ballBtn);
    shadow.appendChild(ballBtn);

    shadow.appendChild(this.menu.getElement());

    this.doc.addEventListener('click', () => this.menu.hide(), true);
    this.appendToBody(container);
  }

  unmount(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadow = null;
      this.ballBtn = null;
    }
  }

  // ── public API ──

  onTranslate(cb: BallCallback): void { this.translateCb = cb; }
  onRestore(cb: BallCallback): void { this.restoreCb = cb; }
  onSettings(cb: BallCallback): void { this.settingsCb = cb; }
  onModeToggle(cb: BallCallback): void { this.modeToggleCb = cb; }
  onCancel(cb: BallCallback): void { this._cancelCb = cb; }

  setModeMenuLabel(mode: 'append' | 'replace'): void {
    this.menu.setModeLabel(mode);
  }

  setTranslating(active: boolean): void {
    if (!this.ballBtn) return;
    if (active) {
      this.ballBtn.textContent = '✕';
      this.ballBtn.style.background = '#ef4444';
      this.ballBtn.title = '点击取消翻译';
      this._isTranslating = true;
    } else {
      this.ballBtn.textContent = this._isTranslated ? '原' : '译';
      this.ballBtn.style.background = '#4f46e5';
      this.ballBtn.title = this._isTranslated ? '点击还原原文' : '点击翻译此页';
      this._isTranslating = false;
    }
  }

  setTranslated(active: boolean): void {
    this._isTranslated = active;
    if (!this.ballBtn || this._isTranslating) return;
    this.ballBtn.textContent = active ? '原' : '译';
    this.ballBtn.title = active ? '点击还原原文' : '点击翻译此页';
  }

  setPosition(x: number, y: number): void {
    const vw = this.doc.defaultView?.innerWidth || 1024;
    const vh = this.doc.defaultView?.innerHeight || 768;
    this.x = Math.max(-20, Math.min(x, vw - 20));
    this.y = Math.max(-20, Math.min(y, vh - 20));
    this.applyPosition();
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  // ── event binding ──

  private bindEvents(ballBtn: HTMLElement): void {
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

    ballBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const vw = this.doc.defaultView?.innerWidth || 1024;
      const vh = this.doc.defaultView?.innerHeight || 768;
      this.menu.toggle(this.x, this.y, vw, vh);
    });

    // ── pointer events (drag) ──
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

    const endDrag = () => {
      this.dragging = false;
      if (this.hasMoved) this.snapToEdge();
    };
    ballBtn.addEventListener('pointerup', endDrag);
    ballBtn.addEventListener('pointerleave', endDrag);

    // ── hover: unsnap / resnap ──
    ballBtn.addEventListener('mouseenter', () => this.unsnapForHover());
    ballBtn.addEventListener('mouseleave', () => this.resnapAfterHover());
  }

  // ── position ──

  private appendToBody(container: HTMLElement): void {
    if (this.doc.body) {
      this.doc.body.appendChild(container);
      this.finalizePosition();
      return;
    }
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
    if (this.x === 0 && this.y === 0) this.loadPosition();
    this.applyPosition();
  }

  private loadPosition(): void {
    const vw = this.doc.defaultView?.innerWidth || 1024;
    const vh = this.doc.defaultView?.innerHeight || 768;
    this.x = vw - 56;
    this.y = vh - 56;
  }

  private applyPosition(): void {
    if (!this.container) return;
    this.container.style.left = `${this.x}px`;
    this.container.style.top = `${this.y}px`;
  }

  // ── snap / hover ──

  private snapToEdge(): void {
    const vw = this.doc.defaultView?.innerWidth || 1024;
    const vh = this.doc.defaultView?.innerHeight || 768;

    this._isSnapped = false;
    if (this.x < SNAP_DISTANCE) { this.x = -(40 - SNAP_SHOW); this._isSnapped = true; }
    else if (this.x > vw - 40 - SNAP_DISTANCE) { this.x = vw - SNAP_SHOW; this._isSnapped = true; }
    if (this.y < SNAP_DISTANCE) { this.y = -(40 - SNAP_SHOW); this._isSnapped = true; }
    else if (this.y > vh - 40 - SNAP_DISTANCE) { this.y = vh - SNAP_SHOW; this._isSnapped = true; }

    this.x = Math.max(SNAP_CLAMP_MIN, Math.min(this.x, vw - SNAP_CLAMP_MAX));
    this.y = Math.max(SNAP_CLAMP_MIN, Math.min(this.y, vh - SNAP_CLAMP_MAX));

    this.applyPosition();
    this.updateOpacity();
    setBallPosition(this.x, this.y);
  }

  private unsnapForHover(): void {
    if (!this._isSnapped) return;
    if (this._hoverTimer) { clearTimeout(this._hoverTimer); this._hoverTimer = null; }
    const vw = this.doc.defaultView?.innerWidth || 1024;
    const vh = this.doc.defaultView?.innerHeight || 768;
    if (this.x < 0) this.setPosition(8, this.y);
    else if (this.x > vw - 40) this.setPosition(vw - 48, this.y);
    if (this.y < 0) this.setPosition(this.x, 8);
    else if (this.y > vh - 40) this.setPosition(this.x, vh - 48);
    this.updateOpacity();
  }

  private resnapAfterHover(): void {
    if (!this._isSnapped) return;
    this._hoverTimer = setTimeout(() => this.snapToEdge(), HOVER_RESNAP_MS);
  }

  private updateOpacity(): void {
    if (!this.ballBtn) return;
    const vw = this.doc.defaultView?.innerWidth || 1024;
    const vh = this.doc.defaultView?.innerHeight || 768;
    const nearEdge =
      this.x < 30 || this.x > vw - 70 || this.y < 30 || this.y > vh - 70;
    this.ballBtn.style.opacity = (nearEdge && this._isSnapped) ? '0.5' : '1';
    this.ballBtn.style.transition = 'opacity 0.3s';
  }
}
