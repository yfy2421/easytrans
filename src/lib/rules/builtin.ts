/**
 * 内置站点规则 — 移植自沉浸式翻译 specialRules.js (2023.1.17 开源版)。
 *
 * 每条规则告诉提取器在特定网站上应该翻译哪些元素（selectors）、
 * 限制在哪个区域（containerSelectors）、跳过哪些（noTranslateSelectors）。
 */

export interface SiteRule {
  /** Human-readable name */
  name?: string;
  /** Exact hostname match */
  hostname?: string | string[];
  /** URL regex match */
  regex?: string | string[];
  /** CSS selectors for translatable content */
  selectors?: string[];
  /** CSS selectors that define the translation scope */
  containerSelectors?: string | string[];
  /** CSS selectors to skip within scope */
  noTranslateSelectors?: string[];
  /** Force language detection even for short text */
  detectLanguage?: boolean;
  /** Visual style override: 'none' = no special styling */
  style?: string;
}

// ── Rule definitions ──

export const BUILTIN_RULES: SiteRule[] = [
  // Twitter / X
  {
    name: 'twitter',
    hostname: ['twitter.com', 'tweetdeck.twitter.com', 'mobile.twitter.com', 'x.com'],
    selectors: [
      '[data-testid="tweetText"]', '.tweet-text', '.js-quoted-tweet-text',
      '[data-testid="card.layoutSmall.detail"] > div:nth-child(2)',
      '[data-testid="card.layoutLarge.detail"] > div:nth-child(2)',
    ],
    detectLanguage: true,
  },
  // Hacker News
  {
    name: 'ycombinator',
    hostname: 'news.ycombinator.com',
    selectors: ['.titleline > a', '.comment', '.toptext', 'a.hn-item-title', '.hn-comment-text', '.hn-story-title'],
  },
  // Reddit
  {
    name: 'reddit',
    hostname: 'www.reddit.com',
    selectors: ['h1', '[data-click-id=body] h3', '[data-click-id=background] h3'],
    containerSelectors: ['[data-testid=comment]', '.Comment__body', 'faceplate-batch .md'],
    detectLanguage: true,
  },
  // Old Reddit compact — must come before oldReddit (hostname match would catch .compact URLs)
  {
    name: 'oldRedditCompact',
    regex: 'old\\.reddit\\.com.*\\/\\.compact$',
    selectors: ['.title > a'],
    containerSelectors: ['.usertext-body'],
    detectLanguage: true,
  },
  // Old Reddit
  {
    name: 'oldReddit',
    hostname: 'old.reddit.com',
    selectors: ['p.title > a'],
    containerSelectors: ['[role=main] .md-container'],
    detectLanguage: true,
  },
  // GitHub
  {
    name: 'github',
    hostname: 'github.com',
    selectors: ['.markdown-title'],
    containerSelectors: '.markdown-body',
    detectLanguage: true,
  },
  // Gist GitHub
  {
    name: 'gist',
    hostname: 'gist.github.com',
    containerSelectors: ['.markdown-body', '.readme'],
    detectLanguage: true,
  },
  // YouTube
  {
    name: 'youtube',
    hostname: 'www.youtube.com',
    selectors: ['#content-text'],
    detectLanguage: true,
  },
  // Facebook
  {
    name: 'facebook',
    hostname: 'www.facebook.com',
    selectors: [
      'div[data-ad-comet-preview=message] > div > div',
      'div[role=article] > div > div > div > div > div > div > div > div',
    ],
    detectLanguage: true,
  },
  // Stack Overflow / Stack Exchange
  {
    name: 'stackoverflow',
    hostname: ['stackoverflow.com', 'superuser.com', 'askubuntu.com', 'serverfault.com'],
    regex: 'stackexchange\\.com',
    selectors: ['.s-post-summary--content-title', 'h1 > a', '.comment-copy'],
    containerSelectors: '[itemprop=text]',
  },
  // ArXiv
  {
    name: 'arxiv',
    hostname: 'arxiv.org',
    selectors: ['blockquote.abstract', 'h1.title', 'h2', 'h3'],
    containerSelectors: '#content',
  },
  // Discord
  {
    name: 'discord',
    hostname: 'discord.com',
    selectors: ['div[id^="message-content-"]', 'div[class^="header-"]'],
    detectLanguage: true,
  },
  // Telegram Web
  {
    name: 'telegram',
    regex: 'web\\.telegram\\.org/z/',
    selectors: ['.text-content'],
    detectLanguage: true,
  },
  // Slack
  {
    name: 'slack',
    regex: '\\.slack\\.com\\/',
    selectors: ['.p-rich_text_section'],
    detectLanguage: true,
  },
  // Notion
  {
    name: 'notion',
    hostname: 'www.notion.so',
    regex: 'notion\\.site',
    selectors: ['div[data-block-id]'],
  },
  // Substack
  {
    name: 'substack',
    regex: '\\.substack\\.com\\/',
    selectors: ['.post-preview-title', '.post-preview-description'],
    containerSelectors: ['.post', '.comment-body'],
  },
  // Gmail
  {
    name: 'gmail',
    hostname: 'mail.google.com',
    selectors: ['h2[data-thread-perm-id]', 'span[data-thread-id]'],
    containerSelectors: ['div[data-message-id]'],
    detectLanguage: true,
  },
  // Google Search
  {
    name: 'google',
    regex: '^https:\\/\\/www\\.google\\.',
    selectors: [
      'h2', 'a h3', 'div[data-content-feature="1"] > div',
      'a [aria-level="3"]', 'a [aria-level="3"] + div', '.Uroaid',
    ],
    detectLanguage: true,
  },
  // LinkedIn
  {
    name: 'linkedin',
    hostname: 'www.linkedin.com',
    selectors: ['.feed-shared-update-v2__description-wrapper'],
    containerSelectors: ['article.jobs-description__container'],
  },
  // Bloomberg
  {
    name: 'bloomberg',
    regex: ['www\\.bloomberg\\.com/[A-Za-z0-9]+$', 'www\\.bloomberg\\.com/$'],
    selectors: [
      'article h3', 'article .single-story-module__headline-link',
      'article [data-tracking-type=Story]', 'article .story-list-story__info__headline',
    ],
    containerSelectors: 'article',
  },
  // Yahoo Finance
  {
    name: 'yahooFinance',
    regex: 'finance\\.yahoo\\.com/$',
    selectors: ['h3'],
  },
  // NYTimes
  {
    name: 'nytimes',
    hostname: 'www.nytimes.com',
    selectors: ['h1'],
    containerSelectors: '[name=articleBody]',
  },
  // Reuters
  {
    name: 'reuters',
    hostname: 'www.reuters.com',
    containerSelectors: 'main',
  },
  // WSJ / Economist
  {
    name: 'wsj',
    hostname: ['www.wsj.com', 'www.economist.com'],
    containerSelectors: 'main',
  },
  // Nature
  {
    name: 'nature',
    hostname: 'www.nature.com',
    containerSelectors: 'article',
  },
  // ScienceDirect
  {
    name: 'sciencedirect',
    hostname: 'www.sciencedirect.com',
    selectors: ['h1'],
    containerSelectors: 'article',
  },
  // Cell
  {
    name: 'cell',
    hostname: 'www.cell.com',
    selectors: [
      'div.section-paragraph > div.section-paragraph > div.section-paragraph',
      'section > div.section-paragraph', 'h4', 'h3', 'h2',
    ],
  },
  // New Yorker
  {
    name: 'newyorker',
    hostname: 'www.newyorker.com',
    selectors: ['h1', '[data-testid=SummaryItemHed]'],
    containerSelectors: ['[data-testid=BodyWrapper]'],
  },
  // Politico
  {
    name: 'politico',
    hostname: 'www.politico.com',
    containerSelectors: 'main',
  },
  // ProductHunt
  {
    name: 'producthunt',
    hostname: 'www.producthunt.com',
    selectors: [
      'h2', 'div.layoutCompact div[class^="styles_htmlText__"]',
      'a[href^="/discussions/"].fontWeight-600',
    ],
    containerSelectors: ['div[class^="styles_htmlText__"]'],
  },
  // Lobsters
  {
    name: 'lobsters',
    hostname: 'lobste.rs',
    selectors: ['.u-repost-of'],
    containerSelectors: ['.comment_text'],
  },
  // IndieHackers
  {
    name: 'indiehackers',
    hostname: 'www.indiehackers.com',
    containerSelectors: ['.content'],
    selectors: ['h1', '.feed-item__title-link'],
  },
  // Readwise Reader
  {
    name: 'readwise',
    hostname: 'read.readwise.io',
    selectors: ['div[class^="_titleRow_"]', 'div[class^="_description_"]'],
    containerSelectors: ['#document-text-content'],
    detectLanguage: true,
  },
  // Inoreader
  {
    name: 'inoreader',
    hostname: 'www.inoreader.com',
    selectors: ['.article_title'],
    containerSelectors: ['.article_content'],
    detectLanguage: true,
  },
  // Daily.dev
  {
    name: 'dailydev',
    hostname: 'app.daily.dev',
    selectors: ['h1', '.typo-body', 'article h3'],
    containerSelectors: ['[class^=markdown_markdown]'],
  },
  // Seeking Alpha
  {
    name: 'seekingalpha',
    hostname: 'seekingalpha.com',
    selectors: ['[data-test-id="post-list-item"] h3'],
    containerSelectors: ['div.wsb_section', '[data-test-id=card-container]'],
  },
  // HN Algolia
  {
    name: 'hnAlgolia',
    hostname: 'hn.algolia.com',
    selectors: ['.Story_title'],
  },
  // Apple Developer Docs
  {
    name: 'appleDev',
    regex: 'developer\\.apple\\.com\\/documentation',
    selectors: ['.contenttable .content', 'h3.title'],
  },
  // MDN — added for our compatibility
  {
    name: 'mdn',
    hostname: 'developer.mozilla.org',
    containerSelectors: 'article',
    selectors: ['h1', 'h2', 'h3', 'h4', 'p', 'li', 'dd', 'blockquote'],
  },
  // Wikipedia — TOC is in nav, content in #bodyContent
  {
    name: 'wikipedia',
    hostname: ['en.wikipedia.org', 'zh.wikipedia.org', 'ja.wikipedia.org'],
    regex: '\\.wikipedia\\.org',
    containerSelectors: '#bodyContent',
  },
];
