#!/usr/bin/env node
/**
 * Scaffold a new post.
 *
 *   npm run new -- "Rooting the Sherlock box"
 *
 * Creates posts/YYYY-MM-DD-rooting-the-sherlock-box.md with frontmatter
 * already filled in and `draft: true` so it stays unlisted until you flip it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(ROOT, 'posts');

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('usage: npm run new -- "Your post title"');
  process.exit(1);
}

const slug = title
  .toLowerCase()
  .replace(/[^\w\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-');

const today = new Date().toISOString().slice(0, 10);
const file = path.join(POSTS_DIR, `${today}-${slug}.md`);

if (fs.existsSync(file)) {
  console.error(`already exists: ${path.relative(ROOT, file)}`);
  process.exit(1);
}

const template = `---
title: ${title}
date: ${today}
tags: []
summary:
draft: true
---

Opening paragraph — this becomes the social-card description if you leave
\`summary\` empty, so make the first line count.

## Background

What the target was, why you were looking at it.

## Enumeration

\`\`\`bash
nmap -sC -sV -oN scan.txt 10.10.10.10
\`\`\`

## Foothold

What actually worked.

## Takeaways

- What you'd do faster next time.
`;

fs.mkdirSync(POSTS_DIR, { recursive: true });
fs.writeFileSync(file, template, 'utf8');
console.log(`created ${path.relative(ROOT, file)}\n\nnext: npm run dev   (builds with drafts + serves on :4000)`);
