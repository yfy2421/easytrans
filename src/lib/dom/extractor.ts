/**
 * DOM 文本提取器 — 遍历 DOM 树，收集可翻译文本节点。
 *
 * 过滤规则（来自 ARCHITECTURE.md §4.1）：
 * - 跳过不可见元素（display:none, visibility:hidden, opacity:0）
 * - 跳过非内容标签（script, style, noscript）
 * - 跳过代码标签（code, pre, kbd, var, samp）
 * - 跳过语义化非内容区域（nav, footer, header）
 * - 跳过 aria-hidden="true"
 * - 跳过 translate="no"
 * - 文本按块级元素分组
 */

// Tags whose text content should never be translated
const NON_CONTENT_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'code',
  'pre',
  'kbd',
  'var',
  'samp',
]);

// Semantic containers that are skipped by default
// nav/header/footer are skipped (sidebar/menu UI), but TOC-like containers
// inside them are NOT skipped so Wikipedia-style table-of-contents still works.
const SKIP_CONTAINERS = new Set(['nav', 'header', 'footer', 'aside']);

// Classes that indicate a sidebar, menu, or toolbar — always skipped
const UI_PATTERNS = ['sidebar', 'side-bar', 'menu', 'toolbar', 'panel', 'widget', 'navbox', 'navigation'];
// Classes that indicate TOC/content within a skipped container — NOT skipped
const TOC_PATTERNS = ['toc', 'table-of-contents', 'toclevel', 'toctext', 'toctoggle', 'contents'];

function hasTocClass(el: Element): boolean {
  const cls = (el as HTMLElement).className?.toLowerCase?.() ?? '';
  return TOC_PATTERNS.some((p) => cls.includes(p));
}

function hasUiClass(el: Element): boolean {
  const cls = (el as HTMLElement).className?.toLowerCase?.() ?? '';
  return UI_PATTERNS.some((p) => cls.includes(p));
}

// Our own UI elements — never translate these
const OWN_IDS = new Set(['bianyi-floating-ball', 'bianyi-top-bar']);
const OWN_CLASSES = ['bianyi-translation'];

function isOwnElement(el: Element | null): boolean {
  while (el) {
    if (OWN_IDS.has(el.id)) return true;
    for (const cls of OWN_CLASSES) {
      if (el.classList.contains(cls)) return true;
    }
    el = el.parentElement;
  }
  return false;
}

// Block-level elements that start a new text chunk
const BLOCK_TAGS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'td', 'th', 'blockquote', 'section', 'article',
  'aside', 'main', 'figcaption', 'dt', 'dd', 'pre',
]);

export interface TextChunk {
  /** Combined text content of this chunk */
  text: string;
  /** The Text nodes that make up this chunk (for later injection) */
  nodes: Text[];
  /** The nearest block-level ancestor element */
  container: Element;
}

function isVisible(node: Node): boolean {
  const el = node.nodeType === 1 ? (node as Element) : (node.parentElement);
  if (!el) return true;

  const style = (el as HTMLElement).style;
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) === 0) return false;

  if (el.getAttribute('aria-hidden') === 'true') return false;

  return true;
}

function isTranslatable(node: Text): boolean {
  if (!node.textContent || !node.textContent.trim()) return false;
  if (!isVisible(node)) return false;
  if (isOwnElement(node.parentElement)) return false;

  // Walk up the ancestor chain to check for skip conditions
  let parent: Element | null = node.parentElement;
  while (parent) {
    if (NON_CONTENT_TAGS.has(parent.tagName.toLowerCase())) return false;
    if (parent.getAttribute('translate') === 'no') return false;
    parent = parent.parentElement;
  }

  return true;
}

function findBlockAncestor(el: Element | null): Element | null {
  while (el) {
    if (BLOCK_TAGS.has(el.tagName.toLowerCase())) return el;
    el = el.parentElement;
  }
  return null;
}

function hasSkippedAncestor(el: Element | null): boolean {
  let passedToc = false;
  while (el) {
    const tag = el.tagName.toLowerCase();
    // Track whether we passed a TOC element on the way up —
    // a <nav> containing a <div class="toc"> should NOT be skipped.
    if (hasTocClass(el)) passedToc = true;
    // Skip UI containers (nav/header/footer/aside) unless we're inside a TOC
    if (SKIP_CONTAINERS.has(tag) && !passedToc) return true;
    el = el.parentElement;
  }
  return false;
}

function mergeChunk(
  node: Text,
  container: Element,
  chunkMap: Map<Element, TextChunk>,
  chunks: TextChunk[],
): void {
  const existing = chunkMap.get(container);
  const raw = node.textContent || '';
  // Trim but keep original leading/trailing context for smart joining
  const trimmed = raw.trim();
  if (!trimmed) return;

  if (existing) {
    const prev = existing.text;
    // Add space only when necessary: neither side is punctuation/whitespace
    const needSpace =
      prev.length > 0 &&
      !/[\s([{<「【（《]$/.test(prev) &&
      !/^[\s)\]}>」】）》.,;:!?]/.test(trimmed);
    existing.text += (needSpace ? ' ' : '') + trimmed;
    existing.nodes.push(node);
  } else {
    const chunk: TextChunk = {
      text: trimmed,
      nodes: [node],
      container,
    };
    chunkMap.set(container, chunk);
    chunks.push(chunk);
  }
}

function hasBrBefore(node: Node): boolean {
  // Check if the previous sibling or previous element is a <br>
  let prev = node.previousSibling;
  while (prev) {
    if (prev.nodeType === 1 && (prev as Element).tagName === 'BR') return true;
    if (prev.nodeType === 3 && prev.textContent?.trim()) return false; // hit another text node
    prev = prev.previousSibling;
  }
  return false;
}

function walkTextNodes(
  root: Node,
  chunkMap: Map<Element, TextChunk>,
  chunks: TextChunk[],
  skipUi: boolean,
): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (!isTranslatable(node)) continue;
    if (skipUi && hasSkippedAncestor(node.parentElement)) continue;

    const container = findBlockAncestor(node.parentElement);
    if (!container) continue;

    // If preceded by <br>, start a new chunk for this container
    if (hasBrBefore(node) && chunkMap.has(container)) {
      const prevChunk = chunkMap.get(container);
      if (prevChunk) {
        // Reassign prev chunk's container to something else, or remove from map
        chunkMap.delete(container);
      }
    }

    mergeChunk(node, container, chunkMap, chunks);
  }
}

function walkShadowRoots(
  root: Node,
  chunkMap: Map<Element, TextChunk>,
  chunks: TextChunk[],
  skipUi: boolean,
): void {
  const elWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let el: Element | null;
  while ((el = elWalker.nextNode() as Element | null)) {
    if (isOwnElement(el)) continue;
    if (el.shadowRoot) {
      walkTextNodes(el.shadowRoot, chunkMap, chunks, skipUi);
      walkShadowRoots(el.shadowRoot, chunkMap, chunks, skipUi);
    }
  }
}

/**
 * Extract translatable text nodes from a DOM subtree, grouped into chunks
 * by block-level elements. Penetrates Shadow DOM boundaries.
 *
 * @param skipUi     Skip nav/header/footer/aside. Default true (append mode).
 * @param splitLinks Split chunks at <a> boundaries for per-link translation. (replace mode)
 */
export function extractTextNodes(root: Node, skipUi = true): TextChunk[] {
  const chunks: TextChunk[] = [];
  const chunkMap = new Map<Element, TextChunk>();

  walkTextNodes(root, chunkMap, chunks, skipUi);
  walkShadowRoots(root, chunkMap, chunks, skipUi);

  return chunks;
}
