# blog.nandakumar.online

Static blog for [nandakumar.online](https://nandakumar.online). Markdown in, static
HTML out — no database, no CMS, no runtime. Deployed to GitHub Pages by CI on every
push to `main`.

```
posts/*.md  ──▶  node build.js  ──▶  dist/  ──▶  GitHub Pages
```

---

## Writing a post

```bash
npm run new -- "Rooting the Sherlock box"
```

That creates `posts/YYYY-MM-DD-rooting-the-sherlock-box.md` with the frontmatter filled
in and `draft: true`, so it stays unlisted until you're ready.

Write the post, then preview it:

```bash
npm run dev      # builds with drafts included, serves on http://localhost:4000
```

When it's ready, set `draft: false` and push:

```bash
git add . && git commit -m "post: rooting the sherlock box" && git push
```

CI builds and deploys. Live in a minute or two.

### Frontmatter

```yaml
---
title: Rooting the Sherlock box     # required
date: 2026-09-15                    # required
tags: [writeup, linux]              # optional, lowercased automatically
summary: One-line teaser.           # optional — falls back to the first paragraph
draft: false                        # optional — true hides it from index + feed
slug: custom-url-slug               # optional — defaults to the filename
---
```

The `summary` is what shows in the post list and in social-share cards, so it's worth
writing one rather than letting it fall back.

### What markdown gets you

Standard GFM, plus some build-time treatment:

- **Fenced code blocks** are syntax-highlighted at build time (no client-side JS) and
  get a terminal-style title bar with a working copy button. Tag the language:
  ` ```bash `, ` ```python `, ` ```http `.
- **Headings** (`##`, `###`) get anchor links and feed the on-page table of contents,
  which appears automatically once a post has 3+ headings.
- **Tables** are wrapped so they scroll horizontally instead of breaking the layout.
- **Images** with a title become a `<figure>` with a caption. Put files in `assets/`
  and reference them as `/assets/name.png`.
- **External links** get `target="_blank" rel="noopener noreferrer"` automatically.

> **Writing about payloads:** markdown passes raw HTML straight through, the same as
> Jekyll or Hugo. So an unquoted `<script>` or `<img src=x onerror=1>` in prose becomes
> a real tag and will break the page. Always wrap payloads in backticks —
> `` `<script>alert(1)</script>` `` — or in a fenced block. Inside either, they're
> escaped and render as text.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Build **with drafts** + serve on `localhost:4000` |
| `npm run build` | Build published posts into `dist/` |
| `npm run preview` | Build without drafts + serve, i.e. exactly what ships |
| `npm run new -- "Title"` | Scaffold a new draft post |
| `npm run og` | Regenerate the social share card (`assets/og-default.png`) |

---

## What gets generated

```
dist/
  index.html                     post list with live tag filtering
  posts/<slug>/index.html        one page per post
  tags/index.html                all tags
  tags/<tag>/index.html          one page per tag
  404.html                       terminal-styled not-found page
  feed.xml                       RSS 2.0, full post content
  sitemap.xml                    every published URL
  robots.txt
  CNAME                          blog.nandakumar.online
  .nojekyll                      tells Pages to skip Jekyll
  assets/                        copied verbatim from assets/
```

Each post page carries its own `<title>`, meta description, canonical URL, OpenGraph
and Twitter card tags, and `BlogPosting` JSON-LD — so posts index properly and preview
correctly when shared.

Drafts are excluded from the index, the feed and the sitemap. When built with
`--drafts` they also get `noindex,nofollow`, so a preview deploy can't get indexed.

---

## The social share card

`og:image` is only emitted when `assets/og-default.png` actually exists — a broken
image reference is worse than none. Generate it once:

```bash
npm run og
```

It renders the card using whichever headless Chrome or Edge you already have. If that
can't find a browser, open `assets/og-default.svg` and export a 1200×630 PNG by hand to
the same path. Either way, the next build picks it up automatically.

---

## Deployment

Handled by `.github/workflows/deploy.yml` — builds on every push to `main` and deploys
`dist/` via GitHub Pages. Nothing is committed from the build; `dist/` is gitignored.

Repo settings that need to be right (one-time):

1. **Settings → Pages → Source** = **GitHub Actions**
2. **Settings → Pages → Custom domain** = `blog.nandakumar.online`
3. **Enforce HTTPS** checked (available once the certificate is issued)

And at the DNS host (GoDaddy), one record:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `blog` | `notkidding.github.io` |

Note the trailing dot GoDaddy may add — that's fine. Propagation is usually minutes,
occasionally up to an hour, and GitHub then needs a few more minutes to issue the TLS
certificate.

---

## Configuration

Site-wide values — name, URL, description, social links — live in `site.config.js`.
Nothing else hardcodes them.

Layout and page shells are in `lib/templates.js`; the design tokens in
`assets/style.css` are mirrored from the main portfolio so the two sites stay visually
consistent. If you change a colour on the portfolio, change it in both `:root` blocks.
