#!/usr/bin/env node
/**
 * Render assets/og-default.png — the 1200x630 social card used by og:image.
 *
 *   npm run og
 *
 * Uses whichever headless Chrome or Edge is already installed, so there's no
 * extra dependency. Once the PNG exists, build.js starts emitting the og:image
 * and twitter:image tags automatically (see lib/templates.js).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'assets', 'og-default.png');

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const browser = CANDIDATES.find((p) => fs.existsSync(p));
if (!browser) {
  console.error(
    'No Chrome or Edge found. Set CHROME_PATH to a Chromium binary, or open\n' +
    'assets/og-default.svg in a browser and export a 1200x630 PNG by hand.'
  );
  process.exit(1);
}

const html = `<!doctype html>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0}
  html,body{width:1200px;height:630px;overflow:hidden}
  body{
    position:relative;padding:86px 90px;
    font-family:"Space Grotesk",system-ui,sans-serif;color:#f6fdfe;
    background:
      radial-gradient(60% 50% at 85% 10%, rgba(16,48,96,.55) 0%, transparent 70%),
      radial-gradient(70% 60% at 10% 90%, rgba(16,48,96,.45) 0%, transparent 70%),
      linear-gradient(180deg,#0b2147 0%,#07172e 100%);
    display:flex;flex-direction:column;justify-content:space-between;
  }
  .grid{
    position:absolute;inset:0;pointer-events:none;opacity:.5;
    background-image:
      linear-gradient(rgba(123,181,245,.18) 1px,transparent 1px),
      linear-gradient(90deg,rgba(123,181,245,.18) 1px,transparent 1px);
    background-size:48px 48px;
  }
  .scan{
    position:absolute;inset:0;pointer-events:none;opacity:.55;
    background-image:linear-gradient(180deg,rgba(123,181,245,.045) 50%,transparent 50%);
    background-size:100% 3px;
  }
  .inner{position:relative;z-index:1}
  .eyebrow{
    display:inline-flex;align-items:center;gap:12px;
    font-family:"JetBrains Mono",monospace;font-size:16px;letter-spacing:.24em;color:#7bb5f5;
    padding:10px 18px;border:1px solid rgba(123,181,245,.35);border-radius:999px;
    background:rgba(123,181,245,.07);
  }
  .eyebrow i{width:9px;height:9px;border-radius:50%;background:#7bf5b5;display:block}
  h1{font-size:108px;font-weight:700;letter-spacing:-.045em;line-height:1;margin:38px 0 0}
  h1 span{color:#7bb5f5}
  p{margin:26px 0 0;font-size:28px;line-height:1.5;color:rgba(246,253,254,.62);max-width:20ch}
  .foot{
    position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;
    border-top:1px solid rgba(123,181,245,.22);padding-top:26px;
    font-family:"JetBrains Mono",monospace;font-size:21px;letter-spacing:.2em;color:#a4ccf5;
  }
  .foot .l{display:flex;align-items:center;gap:16px}
  .foot .l i{width:13px;height:13px;border-radius:50%;background:#7bb5f5;box-shadow:0 0 16px rgba(123,181,245,.8);display:block}
  .foot .r{opacity:.55;font-size:19px;letter-spacing:.12em}
  .reticle{position:absolute;right:104px;top:128px;z-index:1}
</style>
<div class="grid"></div><div class="scan"></div>

<svg class="reticle" width="176" height="176" viewBox="0 0 176 176" fill="none" stroke="#7bb5f5">
  <circle cx="88" cy="88" r="62" stroke-opacity=".35" stroke-width="2"/>
  <circle cx="88" cy="88" r="10" fill="#7bb5f5" stroke="none" opacity=".9"/>
  <g stroke-width="3" stroke-linecap="round" stroke-opacity=".6">
    <line x1="88" y1="2"   x2="88" y2="16"/>
    <line x1="88" y1="160" x2="88" y2="174"/>
    <line x1="2"   y1="88" x2="16" y2="88"/>
    <line x1="160" y1="88" x2="174" y2="88"/>
  </g>
</svg>

<div class="inner">
  <div class="eyebrow"><i></i>NOTES FROM THE LAB</div>
  <h1>field <span>notes</span>.</h1>
  <p>Write-ups on red teaming &amp; offensive security.</p>
</div>

<div class="foot">
  <div class="l"><i></i>K.S_NANDAKUMAR // RED_TEAM</div>
  <div class="r">blog.nandakumar.online</div>
</div>
`;

const tmp = path.join(os.tmpdir(), `og-card-${Date.now()}.html`);
fs.writeFileSync(tmp, html, 'utf8');

try {
  execFileSync(browser, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1200,630',
    '--virtual-time-budget=4000', // give the webfonts time to load
    `--screenshot=${OUT}`,
    `file://${tmp.replace(/\\/g, '/')}`,
  ], { stdio: 'inherit' });
} finally {
  fs.rmSync(tmp, { force: true });
}

if (fs.existsSync(OUT)) {
  console.log(`wrote assets/og-default.png (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
  console.log('run `npm run build` — og:image tags are now emitted automatically.');
} else {
  console.error('screenshot failed; export assets/og-default.svg to a 1200x630 PNG by hand instead.');
  process.exit(1);
}
