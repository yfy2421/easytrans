/**
 * 悬浮球 CSS 样式 — Shadow DOM 内使用的所有样式。
 * 从 floating-ball.ts 中提取，方便皮肤系统以后覆写变量。
 */
export const BALL_STYLES = `
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
