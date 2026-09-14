import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from '../site.config.js';

/* Social cards only render raster images, so og:image is emitted solely when a
   real PNG is present. assets/og-default.svg is the source — export it to
   assets/og-default.png (1200x630) and it gets picked up automatically. */
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const OG_IMAGE = fs.existsSync(path.join(ASSETS, 'og-default.png'))
  ? `${SITE.url}/assets/og-default.png`
  : null;

/* ───────── escaping helpers ───────── */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* XML text/attribute escaping for the feed + sitemap */
export const xesc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/* ───────── shared chrome ───────── */

const AMBIENT = `
<div class="bg-layer bg-radial"></div>
<div class="bg-layer bg-grid"></div>
<div class="bg-layer bg-scan"></div>
<div class="bg-layer bg-noise"></div>

<div class="cursor-dot" aria-hidden="true"></div>
<svg class="cursor-reticle" viewBox="0 0 44 44" aria-hidden="true">
  <circle class="ring" cx="22" cy="22" r="14" fill="none" stroke="currentColor" stroke-width="1" stroke-opacity=".55"/>
  <line class="tick" x1="22" y1="2"  x2="22" y2="7"  stroke="currentColor" stroke-width="1.2" stroke-opacity=".7" stroke-linecap="round"/>
  <line class="tick" x1="22" y1="37" x2="22" y2="42" stroke="currentColor" stroke-width="1.2" stroke-opacity=".7" stroke-linecap="round"/>
  <line class="tick" x1="2"  y1="22" x2="7"  y2="22" stroke="currentColor" stroke-width="1.2" stroke-opacity=".7" stroke-linecap="round"/>
  <line class="tick" x1="37" y1="22" x2="42" y2="22" stroke="currentColor" stroke-width="1.2" stroke-opacity=".7" stroke-linecap="round"/>
</svg>`;

/** @param {{depth:number, active?:string}} o  depth = how many dirs deep the page sits */
function nav({ depth, active }) {
  const root = depth === 0 ? './' : '../'.repeat(depth);
  const is = (k) => (active === k ? ' active' : '');
  return `
<nav class="top">
  <div class="shell row">
    <a class="brand" href="${root}">
      <span class="dot"></span>
      <span class="brand-full">K.S_NANDAKUMAR &nbsp;//&nbsp; BLOG</span>
      <span class="brand-short">K.S_N &nbsp;//&nbsp; BLOG</span>
    </a>
    <div class="navlinks">
      <a href="${root}" class="${is('posts').trim()}">POSTS</a>
      <a href="${root}tags/" class="${is('tags').trim()}">TAGS</a>
      <a href="${root}feed.xml">RSS</a>
      <a href="${esc(SITE.portfolio)}" class="ext">PORTFOLIO</a>
    </div>
  </div>
</nav>`;
}

function footer(depth) {
  const root = depth === 0 ? './' : '../'.repeat(depth);
  return `
<footer class="shell">
  <div>© ${new Date().getFullYear()} K.S NANDAKUMAR &nbsp;//&nbsp; NOTES FROM THE LAB</div>
  <div class="flinks">
    <a href="${root}feed.xml">RSS</a>
    <a href="${esc(SITE.portfolio)}">PORTFOLIO</a>
    <a href="${esc(SITE.github)}">GITHUB</a>
  </div>
  <div class="end"><span class="dot"></span><span>SESSION ALIVE</span></div>
</footer>`;
}

/**
 * Full HTML document shell.
 * @param {object} o
 * @param {string} o.title      full <title> text
 * @param {string} o.description meta description
 * @param {string} o.canonical  absolute canonical URL
 * @param {number} o.depth      directory depth for relative asset paths
 * @param {string} o.body       page markup
 * @param {string} [o.active]   nav key to highlight
 * @param {string} [o.ogType]   og:type (default "website")
 * @param {string} [o.head]     extra <head> markup (JSON-LD, article meta)
 * @param {boolean} [o.noindex]
 */
export function page(o) {
  const root = o.depth === 0 ? './' : '../'.repeat(o.depth);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}" />
<link rel="canonical" href="${esc(o.canonical)}" />
${o.noindex ? '<meta name="robots" content="noindex,nofollow" />\n' : ''}<meta name="author" content="${esc(SITE.author)}" />
<meta name="theme-color" content="#07172e" />

<meta property="og:type" content="${esc(o.ogType || 'website')}" />
<meta property="og:site_name" content="${esc(SITE.name)}" />
<meta property="og:title" content="${esc(o.title)}" />
<meta property="og:description" content="${esc(o.description)}" />
<meta property="og:url" content="${esc(o.canonical)}" />
${OG_IMAGE ? `<meta property="og:image" content="${esc(OG_IMAGE)}" />\n<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />\n` : ''}<meta name="twitter:card" content="${OG_IMAGE ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title" content="${esc(o.title)}" />
<meta name="twitter:description" content="${esc(o.description)}" />
${OG_IMAGE ? `<meta name="twitter:image" content="${esc(OG_IMAGE)}" />\n` : ''}
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.name)}" href="${esc(SITE.url)}/feed.xml" />
<link rel="icon" href="${root}assets/favicon.svg" type="image/svg+xml" />

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${root}assets/style.css" />
${o.head || ''}
</head>
<body>
${AMBIENT}
${nav({ depth: o.depth, active: o.active })}
${o.body}
${footer(o.depth)}
<script src="${root}assets/main.js" defer></script>
</body>
</html>
`;
}

/* ───────── post list row ───────── */
export function postRow(p, depth) {
  const root = depth === 0 ? './' : '../'.repeat(depth);
  const tags = (p.tags || []).map((t) => `<span>${esc(t)}</span>`).join('');
  return `
<a class="post-row reveal" href="${root}posts/${esc(p.slug)}/" data-tags="${esc((p.tags || []).join(','))}">
  <div class="rail">
    <span class="date">${esc(p.dateLabel)}</span>
    <span class="read">${esc(p.readingTime)}</span>
  </div>
  <div>
    <h2>${esc(p.title)}${p.draft ? '<span class="draft-flag">DRAFT</span>' : ''}</h2>
    ${p.summary ? `<p class="excerpt">${esc(p.summary)}</p>` : ''}
    ${tags ? `<div class="tags">${tags}</div>` : ''}
  </div>
</a>`;
}

/* ───────── tag filter bar ───────── */
export function filterBar(tagCounts, total) {
  const btns = tagCounts
    .map(([tag, n]) => `<button class="tagbtn" type="button" data-tag="${esc(tag)}" aria-pressed="false">${esc(tag)}<span class="ct">${n}</span></button>`)
    .join('');
  return `
<div class="filterbar reveal">
  <span class="lbl">// FILTER</span>
  <button class="tagbtn" type="button" data-tag="*" aria-pressed="true">ALL<span class="ct">${total}</span></button>
  ${btns}
</div>`;
}
