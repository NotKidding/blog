#!/usr/bin/env node
/**
 * Static blog builder for blog.nandakumar.online
 *
 *   node build.js            build posts/*.md -> dist/
 *   node build.js --drafts   also publish posts marked `draft: true`
 *   node build.js --serve    build, then serve dist/ on http://localhost:4000
 *
 * Every post is a markdown file in posts/ with YAML frontmatter:
 *
 *   ---
 *   title: Rooting the box
 *   date: 2026-09-15
 *   tags: [writeup, linux]
 *   summary: One-line teaser used in listings and social cards.
 *   draft: false
 *   ---
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { Marked } from 'marked';
import hljs from 'highlight.js';

import { SITE } from './site.config.js';
import { page, postRow, filterBar, esc, xesc } from './lib/templates.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(ROOT, 'posts');
const ASSETS_DIR = path.join(ROOT, 'assets');
const DIST = path.join(ROOT, 'dist');

const ARGS = new Set(process.argv.slice(2));
const INCLUDE_DRAFTS = ARGS.has('--drafts');

/* ───────────────────────── markdown ───────────────────────── */

/** Headings collected during a render pass, for the TOC. */
let headings = [];
const slugCounts = new Map();

/** Reverse marked's HTML escaping so headings yield clean slugs and TOC text. */
function toPlainText(html) {
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X'
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(s) {
  const base = String(s)
    .normalize('NFD')              // split accented letters into base + diacritic
    .replace(/[̀-ͯ]/g, '') // drop the diacritics, keeping "café" -> "cafe"
    .toLowerCase()
    .replace(/['‘’]/g, '') // apostrophes vanish: "what's" -> "whats"
    .replace(/[^\w\s-]/g, ' ')      // other punctuation becomes a gap, not a join
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
  const n = slugCounts.get(base) || 0;
  slugCounts.set(base, n + 1);
  return n === 0 ? base : `${base}-${n}`;
}

const marked = new Marked({ gfm: true, breaks: false });

marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      if (depth < 2 || depth > 4) return `<h${depth}>${text}</h${depth}>`;
      // Slug and TOC label come from decoded plain text; the heading itself keeps
      // its inline markup. Re-escaping happens once, in the template.
      const plain = toPlainText(text);
      const id = slugify(plain);
      if (depth <= 3) headings.push({ id, text: plain, depth });
      return `<h${depth} id="${id}">${text}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${depth}>`;
    },

    code({ text, lang }) {
      const language = (lang || '').trim().split(/\s+/)[0].toLowerCase();
      let html;
      let label = language || 'text';
      if (language && hljs.getLanguage(language)) {
        html = hljs.highlight(text, { language, ignoreIllegals: true }).value;
      } else {
        html = esc(text);
      }
      return `<div class="codeblock">
  <div class="cb-bar">
    <span class="b r"></span><span class="b y"></span><span class="b g"></span>
    <span class="cb-lang">${esc(label)}</span>
    <button class="cb-copy" type="button">COPY</button>
  </div>
  <pre><code class="hljs language-${esc(label)}">${html}</code></pre>
</div>`;
    },

    table(token) {
      // Wrap tables so they scroll horizontally instead of breaking the layout.
      const header = token.header
        .map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`)
        .join('');
      const body = token.rows
        .map((row) => `<tr>${row.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`)
        .join('');
      return `<div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
    },

    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const external = /^https?:\/\//i.test(href) && !href.startsWith(SITE.url);
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
      const t = title ? ` title="${esc(title)}"` : '';
      return `<a href="${esc(href)}"${t}${attrs}>${text}</a>`;
    },

    image({ href, title, text }) {
      const cap = title || text;
      const img = `<img src="${esc(href)}" alt="${esc(text)}" loading="lazy" decoding="async">`;
      return cap ? `<figure>${img}<figcaption>${esc(cap)}</figcaption></figure>` : img;
    },
  },
});

function renderMarkdown(md) {
  headings = [];
  slugCounts.clear();
  const html = marked.parse(md);
  return { html, toc: headings };
}

/* ───────────────────────── post loading ───────────────────────── */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function parseDate(value, file) {
  if (value instanceof Date && !isNaN(value)) return value;
  const d = new Date(String(value));
  if (isNaN(d)) {
    throw new Error(`${file}: invalid or missing "date" in frontmatter (got ${JSON.stringify(value)})`);
  }
  return d;
}

function formatDate(d) {
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function readingTime(md) {
  const words = md.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 220))} MIN READ`;
}

function firstParagraph(md) {
  const line = md
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && !l.startsWith('```') && !l.startsWith('>') && !l.startsWith('!['));
  if (!line) return SITE.description;
  const plain = line.replace(/[*_`\[\]]/g, '').replace(/\(https?:\/\/[^)]*\)/g, '');
  return plain.length > 180 ? plain.slice(0, 177).trimEnd() + '…' : plain;
}

function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => /\.mdx?$/i.test(f));

  const posts = files.map((file) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const { data, content } = matter(raw);

    if (!data.title) throw new Error(`${file}: frontmatter is missing "title"`);

    const date = parseDate(data.date, file);
    // Strip a leading YYYY-MM-DD- from the filename when deriving the slug.
    const slug = data.slug || file.replace(/\.mdx?$/i, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');

    const tags = (Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [])
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean);

    return {
      file,
      slug,
      title: String(data.title),
      date,
      dateISO: date.toISOString(),
      dateLabel: formatDate(date),
      tags,
      summary: data.summary ? String(data.summary) : firstParagraph(content),
      draft: data.draft === true,
      readingTime: readingTime(content),
      markdown: content,
      url: `${SITE.url}/posts/${slug}/`,
    };
  });

  const seen = new Map();
  for (const p of posts) {
    if (seen.has(p.slug)) {
      throw new Error(`duplicate slug "${p.slug}" — ${seen.get(p.slug)} and ${p.file}`);
    }
    seen.set(p.slug, p.file);
  }

  return posts
    .filter((p) => INCLUDE_DRAFTS || !p.draft)
    .sort((a, b) => b.date - a.date);
}

/* ───────────────────────── page builders ───────────────────────── */

function tagCounts(posts) {
  const m = new Map();
  for (const p of posts) for (const t of p.tags) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function buildIndex(posts) {
  const counts = tagCounts(posts);
  const rows = posts.map((p) => postRow(p, 0)).join('');

  const body = `
<header class="page-head shell">
  <div class="reveal">
    <div class="h-eyebrow"><span class="blink"></span>NOTES FROM THE LAB</div>
    <h1 class="page-title">field <span class="accent">notes</span>.</h1>
    <p class="lede">
      Write-ups, teardowns and half-finished thoughts on
      <em>red teaming &amp; offensive security</em> — what I broke, how it broke,
      and what I'd do differently next time.
    </p>
  </div>
</header>

<section class="shell">
  <div class="sec-head reveal">
    <div class="n">// LOG</div>
    <div class="title">all entries.</div>
    <div class="sub">${posts.length} POST${posts.length === 1 ? '' : 'S'} &nbsp;//&nbsp; ${counts.length} TAG${counts.length === 1 ? '' : 'S'}</div>
  </div>

  ${counts.length ? filterBar(counts, posts.length) : ''}

  ${posts.length
      ? `<div class="postlist">${rows}</div>
         <div class="empty filter-empty" hidden>// no posts match that tag</div>`
      : `<div class="empty">
           <div><span class="hl">no posts yet</span></div>
           <div style="margin-top:10px;opacity:.75;">
             drop a markdown file into <span class="hl">posts/</span> and run
             <span class="hl">node build.js</span>
           </div>
         </div>`}
</section>`;

  return page({
    title: SITE.name,
    description: SITE.description,
    canonical: `${SITE.url}/`,
    depth: 0,
    active: 'posts',
    body,
    head: `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: SITE.name,
      url: `${SITE.url}/`,
      description: SITE.description,
      author: { '@type': 'Person', name: SITE.author, url: SITE.portfolio },
    })}</script>`,
  });
}

function buildPost(p, prev, next) {
  const { html, toc } = renderMarkdown(p.markdown);

  const tocHtml = toc.length >= 3
    ? `<aside class="toc reveal">
         <div class="toc-t">// ON THIS PAGE</div>
         <ul>${toc.map((h) => `<li class="lvl-${h.depth}"><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`).join('')}</ul>
       </aside>`
    : '';

  const tags = p.tags.length
    ? `<div class="tags">${p.tags.map((t) => `<a href="../../tags/${esc(t)}/">${esc(t)}</a>`).join('')}</div>`
    : '';

  const shareText = encodeURIComponent(p.title);
  const shareUrl = encodeURIComponent(p.url);

  const body = `
<div class="progress" aria-hidden="true"></div>

<article>
  <header class="art-head shell">
    <div class="reveal">
      <div class="art-meta">
        <span class="date">${esc(p.dateLabel)}</span>
        <span class="sep">//</span>
        <span>${esc(p.readingTime)}</span>
        ${p.draft ? '<span class="sep">//</span><span style="color:var(--warn)">DRAFT</span>' : ''}
      </div>
      <h1>${esc(p.title)}</h1>
      ${p.summary ? `<p class="summary">${esc(p.summary)}</p>` : ''}
      ${tags}
      ${p.draft ? '<div class="draft-banner">// UNPUBLISHED DRAFT — not listed in the index or feed</div>' : ''}
    </div>
  </header>

  <div class="shell article-wrap">
    <div class="prose reveal">
      ${html}
    </div>
    ${tocHtml}
  </div>

  <div class="shell">
    <div class="art-foot">
      <div class="share">
        <span class="lbl">// SHARE</span>
        <a href="https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}" target="_blank" rel="noopener">X / TWITTER</a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener">LINKEDIN</a>
        <button id="copy-link" type="button"><span>COPY LINK</span></button>
      </div>

      <div class="prevnext">
        ${next
      ? `<a class="pn prev" href="../${esc(next.slug)}/"><div class="dir">← NEWER</div><div class="t">${esc(next.title)}</div></a>`
      : '<div></div>'}
        ${prev
      ? `<a class="pn next" href="../${esc(prev.slug)}/"><div class="dir">OLDER →</div><div class="t">${esc(prev.title)}</div></a>`
      : '<div></div>'}
      </div>
    </div>
  </div>
</article>`;

  return page({
    title: `${p.title} — ${SITE.author}`,
    description: p.summary,
    canonical: p.url,
    depth: 2,
    active: 'posts',
    ogType: 'article',
    noindex: p.draft,
    body,
    head: `<meta property="article:published_time" content="${esc(p.dateISO)}" />
${p.tags.map((t) => `<meta property="article:tag" content="${esc(t)}" />`).join('\n')}
<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.summary,
      datePublished: p.dateISO,
      dateModified: p.dateISO,
      keywords: p.tags.join(', '),
      mainEntityOfPage: { '@type': 'WebPage', '@id': p.url },
      author: { '@type': 'Person', name: SITE.author, url: SITE.portfolio },
      publisher: { '@type': 'Person', name: SITE.author, url: SITE.portfolio },
    })}</script>`,
  });
}

function buildTagIndex(posts) {
  const counts = tagCounts(posts);
  const body = `
<header class="page-head shell">
  <div class="reveal">
    <div class="h-eyebrow"><span class="blink"></span>INDEX</div>
    <h1 class="page-title">by <span class="accent">tag</span>.</h1>
    <p class="lede">Every topic covered so far, ordered by how much has been written about it.</p>
  </div>
</header>

<section class="shell">
  <div class="sec-head reveal">
    <div class="n">// TAGS</div>
    <div class="title">${counts.length} topic${counts.length === 1 ? '' : 's'}.</div>
  </div>
  ${counts.length
      ? `<div class="filterbar reveal">${counts
        .map(([t, n]) => `<a class="tagbtn" href="./${esc(t)}/">${esc(t)}<span class="ct">${n}</span></a>`)
        .join('')}</div>`
      : '<div class="empty">// no tags yet</div>'}
</section>`;

  return page({
    title: `Tags — ${SITE.name}`,
    description: `All topics written about on ${SITE.shortName}.`,
    canonical: `${SITE.url}/tags/`,
    depth: 1,
    active: 'tags',
    body,
  });
}

function buildTagPage(tag, posts) {
  const rows = posts.map((p) => postRow(p, 2)).join('');
  const body = `
<header class="page-head shell">
  <div class="reveal">
    <div class="h-eyebrow"><span class="blink"></span>TAG</div>
    <h1 class="page-title"><span class="accent">#</span>${esc(tag)}</h1>
    <p class="lede">${posts.length} post${posts.length === 1 ? '' : 's'} tagged <em>${esc(tag)}</em>.</p>
  </div>
</header>

<section class="shell">
  <div class="sec-head reveal">
    <div class="n">// FILTERED</div>
    <div class="title">${esc(tag)}.</div>
    <div class="sub"><a href="../">← ALL TAGS</a></div>
  </div>
  <div class="postlist">${rows}</div>
</section>`;

  return page({
    title: `#${tag} — ${SITE.name}`,
    description: `Posts tagged ${tag} on ${SITE.shortName}.`,
    canonical: `${SITE.url}/tags/${tag}/`,
    depth: 2,
    active: 'tags',
    body,
  });
}

function build404() {
  const body = `
<header class="page-head shell">
  <div class="reveal">
    <div class="h-eyebrow"><span class="blink" style="background:var(--red)"></span>STATUS 404</div>
    <h1 class="page-title">dead <span class="accent">drop</span>.</h1>
    <p class="lede">That path doesn't resolve to anything. The page may have moved, or it never existed.</p>
    <div class="term">
      <div><span class="prompt">$</span> curl -I $REQUESTED_PATH</div>
      <div class="out"><span class="err">HTTP/2 404</span> — no such resource</div>
      <div><span class="prompt">$</span> ls /</div>
      <div class="out"><a href="/" style="color:var(--cyan)">posts/</a> &nbsp; <a href="/tags/" style="color:var(--cyan)">tags/</a> &nbsp; <a href="/feed.xml" style="color:var(--cyan)">feed.xml</a></div>
      <div><span class="prompt">$</span> <span class="ok">_</span></div>
    </div>
  </div>
</header>`;

  return page({
    title: `404 — ${SITE.name}`,
    description: 'Page not found.',
    canonical: `${SITE.url}/404.html`,
    depth: 0,
    body,
    noindex: true,
  });
}

function buildFeed(posts) {
  const items = posts.slice(0, SITE.postsPerFeed).map((p) => {
    const { html } = renderMarkdown(p.markdown);
    return `    <item>
      <title>${xesc(p.title)}</title>
      <link>${xesc(p.url)}</link>
      <guid isPermaLink="true">${xesc(p.url)}</guid>
      <pubDate>${p.date.toUTCString()}</pubDate>
      <description>${xesc(p.summary)}</description>
${p.tags.map((t) => `      <category>${xesc(t)}</category>`).join('\n')}
      <content:encoded><![CDATA[${html.replace(/]]>/g, ']]&gt;')}]]></content:encoded>
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xesc(SITE.name)}</title>
    <link>${xesc(SITE.url)}/</link>
    <description>${xesc(SITE.description)}</description>
    <language>${xesc(SITE.lang)}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${xesc(SITE.url)}/feed.xml" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>
`;
}

function buildSitemap(posts, tags) {
  const urls = [
    { loc: `${SITE.url}/`, pri: '1.0' },
    { loc: `${SITE.url}/tags/`, pri: '0.5' },
    ...posts.filter((p) => !p.draft).map((p) => ({ loc: p.url, pri: '0.8', lastmod: p.dateISO.slice(0, 10) })),
    ...tags.map(([t]) => ({ loc: `${SITE.url}/tags/${t}/`, pri: '0.4' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
      .map((u) => `  <url><loc>${xesc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.pri}</priority></url>`)
      .join('\n')}
</urlset>
`;
}

/* ───────────────────────── fs helpers ───────────────────────── */

function write(relPath, contents) {
  const full = path.join(DIST, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents, 'utf8');
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

/* ───────────────────────── main ───────────────────────── */

function main() {
  const t0 = Date.now();

  const posts = loadPosts();
  const published = posts.filter((p) => !p.draft);
  const listed = INCLUDE_DRAFTS ? posts : published;

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // static assets
  copyDir(ASSETS_DIR, path.join(DIST, 'assets'));

  // pages
  write('index.html', buildIndex(listed));

  // posts sorted newest-first: index i+1 is older, i-1 is newer
  listed.forEach((p, i) => {
    write(`posts/${p.slug}/index.html`, buildPost(p, listed[i + 1] || null, listed[i - 1] || null));
  });

  const tags = tagCounts(listed);
  write('tags/index.html', buildTagIndex(listed));
  for (const [tag] of tags) {
    write(`tags/${tag}/index.html`, buildTagPage(tag, listed.filter((p) => p.tags.includes(tag))));
  }

  write('404.html', build404());
  write('feed.xml', buildFeed(published));
  write('sitemap.xml', buildSitemap(published, tags));
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);

  // GitHub Pages: custom domain + skip Jekyll processing
  write('CNAME', 'blog.nandakumar.online\n');
  write('.nojekyll', '');

  const drafts = posts.length - published.length;
  console.log(
    `built ${listed.length} post${listed.length === 1 ? '' : 's'}` +
    (drafts ? ` (${drafts} draft${drafts === 1 ? '' : 's'}${INCLUDE_DRAFTS ? ' included' : ' skipped'})` : '') +
    `, ${tags.length} tag page${tags.length === 1 ? '' : 's'} → dist/  [${Date.now() - t0}ms]`
  );
}

try {
  main();
} catch (err) {
  console.error('\nbuild failed: ' + err.message + '\n');
  process.exit(1);
}

/* ───────────────────────── optional dev server ───────────────────────── */

if (ARGS.has('--serve')) {
  const { createServer } = await import('node:http');
  const PORT = 4000;
  const TYPES = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  };

  createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(DIST, urlPath);
    // Keep every resolved path inside dist/.
    if (!file.startsWith(DIST)) { res.writeHead(403).end('forbidden'); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(DIST, '404.html')));
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  }).listen(PORT, () => console.log(`\nserving dist/ → http://localhost:${PORT}\n(ctrl-c to stop)`));
}
