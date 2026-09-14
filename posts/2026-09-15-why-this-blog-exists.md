---
title: Why This Blog Exists
date: 2026-09-15
tags: [meta, notes]
summary: A short note on why I'm keeping public write-ups, and what you can expect to find here.
draft: false
---

I've spent a while now working through labs, boxes and bootcamp exercises without writing
much of it down in public. The notes existed — they just lived in scratch files that only
made sense to me a week later. This is the fix.

## What goes here

Mostly three kinds of post:

- **Write-ups** — machines and challenges I've worked through, with the reasoning,
  not just the commands that happened to land.
- **Teardowns** — a tool, a protocol, or a technique pulled apart until I actually
  understand why it works.
- **Field notes** — shorter pieces. Something that cost me two hours and shouldn't
  cost anyone else two hours.

## Why write it down

The obvious answer is that writing forces you to find the gaps. You can follow a
walkthrough end to end and feel like you understand it, right up until you try to
explain *why* a particular payload worked and realise you don't.

The less obvious answer is that a write-up is a report, and reporting is most of the
job. A finding nobody can act on isn't a finding.

> If it isn't written down clearly enough for someone else to reproduce it,
> it didn't really happen.

## How this is built

The site is markdown in, static HTML out. Each post is a file with a bit of frontmatter:

```yaml
---
title: Why This Blog Exists
date: 2026-09-15
tags: [meta, notes]
summary: A short note on why I'm keeping public write-ups.
draft: false
---
```

A build step renders it, highlights the code, generates the tag pages and an RSS feed,
and pushes the result to GitHub Pages. No database, no CMS, nothing to patch.

```bash
npm run new -- "Post title"   # scaffold
npm run dev                   # preview at :4000, drafts included
git push                      # CI builds and deploys
```

That's deliberate. The whole point is that adding a post costs a file and a commit —
low enough friction that I'll actually keep doing it.

## What's next

More posts, shorter posts, and fewer of them sitting in drafts for three weeks.
If you want them as they land, the [RSS feed](/feed.xml) is the reliable way.
