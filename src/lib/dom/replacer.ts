/**
 * 文本替换器 — 模式 2「原生替换」：直接改写 textContent，
 * 不在 DOM 中新增节点，让页面看起来像原本就是目标语言。
 *
 * 安全性：跳过功能耦合元素（按钮、选项、contentEditable 等）。
 */

// Elements whose text must NEVER be replaced — they are functional UI
const UNSAFE_TAGS = new Set(['button', 'option', 'textarea', 'select']);

// Original text backup for restore
let originalMap = new Map<Text, string>();

/** Safety check: can this text node's content be replaced? */
export function isReplaceable(node: Text): boolean {
  if (node.isConnected === false) return false;
  let el: Element | null = node.parentElement;
  while (el) {
    const htmlEl = el as HTMLElement;
    if (htmlEl.isContentEditable || htmlEl.contentEditable === 'true') return false;
    if (UNSAFE_TAGS.has(el.tagName.toLowerCase())) return false;
    if (el.getAttribute('translate') === 'no') return false;
    if (el.classList.contains('notranslate')) return false;
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'submit') return false;
    el = el.parentElement;
  }
  const text = node.textContent?.trim();
  if (!text) return false;
  // Skip text that is only numbers, punctuation, or already CJK
  if (/^[\d\s.,;:!?()[\]{}<>\/\\|@#$%^&*+=~`'"_-]+$/.test(text)) return false;
  return true;
}

/** Replace text nodes with translated versions. Backs up originals for restore.
 *
 *  Each entry maps a single text node to its translation — the content script
 *  sends individual text nodes to Google for per-node translation. */
export function replaceTextNodes(
  entries: { node: Text; translatedText: string }[],
): void {
  const done = new Set<Text>();
  for (const { node, translatedText } of entries) {
    if (!isReplaceable(node) || done.has(node)) continue;
    if (originalMap.has(node)) continue; // already translated, skip overwrite
    originalMap.set(node, node.textContent || '');
    node.textContent = translatedText;
    done.add(node);
  }
}

/** Restore all replaced text nodes to their original content. */
export function restoreTextNodes(): void {
  for (const [node, original] of originalMap) {
    if (node.isConnected) {
      node.textContent = original;
    }
  }
  originalMap = new Map();
}

/** Check if any replacements are currently active. */
export function hasReplacements(): boolean {
  return originalMap.size > 0;
}
