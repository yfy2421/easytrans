/**
 * ContentObserver — 监听 DOM 变化，SPA 路由切换或动态加载内容时触发回调。
 *
 * - 基于 MutationObserver
 * - 去抖合并高频变更
 * - 自动跳过非内容节点（script/style）
 */

type ObserverCallback = (addedNodes: Node[]) => void;

interface ObserverOptions {
  debounceMs?: number;
}

// Tags and classes whose mutations should be ignored
const IGNORED_TAGS = new Set(['script', 'style', 'noscript']);
const IGNORED_CLASSES = ['bianyi-translation', 'bianyi-floating-ball', 'bianyi-top-bar'];

function hasIgnoredAncestor(node: Node): boolean {
  let el: Element | null = node.nodeType === 1 ? (node as Element) : node.parentElement;
  while (el) {
    for (const cls of IGNORED_CLASSES) {
      if (el.classList?.contains(cls)) return true;
    }
    if (IGNORED_TAGS.has(el.tagName.toLowerCase())) return true;
    el = el.parentElement;
  }
  return false;
}

function isRelevantMutation(mutation: MutationRecord): boolean {
  if (mutation.type === 'characterData') {
    return !hasIgnoredAncestor(mutation.target);
  }
  if (mutation.type === 'childList') {
    for (const node of mutation.addedNodes) {
      if (hasIgnoredAncestor(node)) continue;
      if (node.nodeType === 3) return true;
      if (node.nodeType === 1) {
        const el = node as Element;
        if (el.textContent && el.textContent.trim()) return true;
      }
    }
  }
  return false;
}

function collectAddedNodes(mutations: MutationRecord[]): Node[] {
  const nodes: Node[] = [];
  for (const m of mutations) {
    if (m.type === 'childList') {
      for (const node of m.addedNodes) {
        if (hasIgnoredAncestor(node)) continue;
        if (node.nodeType === 3) {
          nodes.push(node);
        } else if (node.nodeType === 1) {
          nodes.push(node);
        }
      }
    } else if (m.type === 'characterData' && m.target.nodeType === 3) {
      if (!hasIgnoredAncestor(m.target)) {
        nodes.push(m.target);
      }
    }
  }
  return nodes;
}

export class ContentObserver {
  private callback: ObserverCallback;
  private debounceMs: number;
  private mutationObserver: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingMutations: MutationRecord[] = [];

  constructor(callback: ObserverCallback, options: ObserverOptions = {}) {
    this.callback = callback;
    this.debounceMs = options.debounceMs ?? 500;
  }

  start(doc: Document): void {
    if (this.mutationObserver) return;

    this.mutationObserver = new MutationObserver((mutations) => {
      const relevant = mutations.filter(isRelevantMutation);
      if (relevant.length === 0) return;

      this.pendingMutations.push(...relevant);
      this.schedule();
    });

    if (doc.body) {
      this.mutationObserver.observe(doc.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    } else {
      // body not yet parsed (document_start on large pages) — poll
      const tryObserve = () => {
        if (doc.body) {
          this.mutationObserver!.observe(doc.body, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        } else {
          requestAnimationFrame(tryObserve);
        }
      };
      requestAnimationFrame(tryObserve);
    }
  }

  stop(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingMutations = [];
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.debounceMs);
  }

  private flush(): void {
    const nodes = collectAddedNodes(this.pendingMutations);
    this.pendingMutations = [];
    if (nodes.length > 0) {
      this.callback(nodes);
    }
  }
}
