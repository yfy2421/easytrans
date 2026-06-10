/**
 * 译文注入器 — 在原文旁插入双语对照译文。
 *
 * 注入策略（按容器类型自适应）：
 * - block    → 独立块级译文，insertAfter 容器
 * - inline   → 内联小字，insertBefore 紧跟原文文本
 * - label    → 短标签容器有子元素，inline insertBefore
 * - group    → 内联列表项，合并为一行译文行
 */

import type { TextChunk } from './extractor';

export const TRANSLATION_CLASS = 'bianyi-translation';

export interface TranslationEntry {
  chunk: TextChunk;
  translatedText: string;
}

// ── state ──

let injectedElements: HTMLElement[] = [];

// ── classification helpers ──

const SKIP_PARENT_TAGS = new Set(['ul', 'ol', 'nav', 'select']);
const HEADING_CLASSES = ['heading', 'title', 'caption', 'label'];

// Elements whose parent HTML structure forbids `afterend` injection
// (td/th must stay inside <tr>, li inside <ul>/<ol>, dt/dd inside <dl>).
// These get inside-safe injection: translation appended as last child.
const INSIDE_SAFE_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'td', 'th', 'li', 'dt', 'dd',
]);

function isBlock(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  // Short labels and heading-classed elements stay inline
  const cls = (el as HTMLElement).className?.toLowerCase?.() ?? '';
  if (HEADING_CLASSES.some((c) => cls.includes(c))) return false;
  // Element whose own display is inline is always inline
  const d = getComputedStyle(el).display;
  if (d === 'inline' || d.startsWith('inline-')) return false;
  const p = el.parentElement;
  if (p) {
    if (SKIP_PARENT_TAGS.has(p.tagName.toLowerCase())) return false;
    const pd = getComputedStyle(p).display;
    // Flex with column direction → children are block-like
    if (pd === 'flex' || pd === 'inline-flex') {
      const flexDir = getComputedStyle(p).flexDirection;
      if (flexDir !== 'column' && flexDir !== 'column-reverse') return false;
    }
    // Grid: injection could break grid layout, stay inline
    if (pd === 'grid' || pd === 'inline-grid') return false;
  }
  return true;
}

function isShortLabel(entry: TranslationEntry): boolean {
  // Inside-safe elements always get block styling regardless of length/children
  const tag = entry.chunk.container.tagName.toLowerCase();
  if (INSIDE_SAFE_TAGS.has(tag)) return false;
  return entry.chunk.text.trim().length < 50 && entry.chunk.container.children.length > 0;
}

function isInlineListItem(el: Element): boolean {
  const d = getComputedStyle(el).display;
  if (d !== 'inline' && d !== 'inline-block') return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'li' || tag === 'dt' || tag === 'dd';
}

function findListAncestor(el: Element): Element | null {
  let p = el.parentElement;
  while (p) {
    const t = p.tagName.toLowerCase();
    if (t === 'ul' || t === 'ol' || t === 'dl') return p;
    if (p.classList.contains('hlist')) return p;
    p = p.parentElement;
  }
  return null;
}

// ── element builders ──

// Lightweight styles inspired by immersive-translate's "weakening" approach.
// Subtle enough to not invade the page, distinct enough to identify as translation.
const BLOCK_STYLE = [
  'display:block',
  'color:#9ca3af',
  'font-size:0.85em',
  'line-height:1.5',
  'margin-top:2px',
  'padding-left:6px',
  'border-left:1px solid #e5e7eb',
].join(';');

const COMPACT_STYLE = [
  'display:block',
  'color:#9ca3af',
  'font-size:0.82em',
  'line-height:1.4',
  'margin-top:1px',
].join(';');

function makeEl(text: string, compact: boolean, container?: Element): HTMLElement {
  const el = document.createElement('div');
  el.className = TRANSLATION_CLASS;
  el.textContent = text;
  // Narrow containers (< 280px): even more minimal, no left border
  const cw = container ? (container as HTMLElement).clientWidth : Infinity;
  if (cw > 0 && cw < 280) {
    el.setAttribute('style', [
      'display:block', 'color:#b0b7c3', 'font-size:0.8em',
      'line-height:1.35', 'margin-top:1px',
    ].join(';'));
  } else {
    el.setAttribute('style', compact ? COMPACT_STYLE : BLOCK_STYLE);
  }
  return el;
}

// ── injection actions ──

/** Append translation to container.
 *  Inside-safe (appendChild) for: structural elements, flex-row/grid children.
 *  Afterend for: normal flow block elements (p, div, section, etc.). */
function injectOne(entry: TranslationEntry, el: HTMLElement): void {
  const container = entry.chunk.container;
  const tag = container.tagName.toLowerCase();
  // Structural elements must keep translation inside
  if (INSIDE_SAFE_TAGS.has(tag)) { container.appendChild(el); return; }
  // Flex row / grid children: afterend would create a new flex/grid item,
  // breaking layout. Keep translation inside as a compact block.
  const p = container.parentElement;
  if (p) {
    const pd = getComputedStyle(p).display;
    if (pd === 'flex' || pd === 'inline-flex') {
      const dir = getComputedStyle(p).flexDirection;
      if (dir !== 'column' && dir !== 'column-reverse') { container.appendChild(el); return; }
    }
    if (pd === 'grid' || pd === 'inline-grid') { container.appendChild(el); return; }
  }
  container.insertAdjacentElement('afterend', el);
}

function injectGroupLine(ancestor: Element, group: TranslationEntry[]): void {
  const parentStyle = getComputedStyle(ancestor.parentElement || ancestor);
  const wrapper = document.createElement('div');
  wrapper.className = TRANSLATION_CLASS;
  wrapper.style.cssText = [
    `text-align:${parentStyle.textAlign}`,
    'margin-top:4px', 'font-size:0.85em', 'color:#52525b',
  ].join(';');
  wrapper.textContent = group.map((e) => e.translatedText).join(' · ');
  ancestor.insertAdjacentElement('afterend', wrapper);
  injectedElements.push(wrapper);
}

// ── public API ──

export function injectTranslations(entries: TranslationEntry[]): void {
  clearExisting();

  // Partition: inline-list items go to groups, everything else standalone
  const groups = new Map<Element, TranslationEntry[]>();
  const standalone: TranslationEntry[] = [];

  for (const entry of entries) {
    if (!entry.chunk.container.isConnected) continue;
    const ancestor = !isBlock(entry.chunk.container) && isInlineListItem(entry.chunk.container)
      ? findListAncestor(entry.chunk.container) : null;
    if (ancestor) {
      if (!groups.has(ancestor)) groups.set(ancestor, []);
      groups.get(ancestor)!.push(entry);
    } else {
      standalone.push(entry);
    }
  }

  // Inject standalone — all with block-level styling
  for (const entry of standalone) {
    const compact = !isBlock(entry.chunk.container) || isShortLabel(entry);
    const el = makeEl(entry.translatedText, compact, entry.chunk.container);
    injectOne(entry, el);
    injectedElements.push(el);
  }

  // Inject group translation lines
  for (const [ancestor, group] of groups) {
    if (group.length > 0) injectGroupLine(ancestor, group);
  }
}

function clearExisting(): void {
  for (const el of injectedElements) el.remove();
  injectedElements = [];
}

export function restoreTranslations(): void {
  clearExisting();
}
