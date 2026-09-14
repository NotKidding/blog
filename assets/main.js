/* blog.nandakumar.online — client runtime
   reveal-on-scroll · tag filter · TOC scrollspy · copy-code · share · custom cursor */

(function () {
  'use strict';

  /* ───────── reveal on scroll ───────── */
  (function reveal() {
    var nodes = document.querySelectorAll('.reveal');
    if (!nodes.length) return;
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach(function (n) { io.observe(n); });
  })();

  /* ───────── tag filter (index + tag pages) ───────── */
  (function tagFilter() {
    var bar = document.querySelector('.filterbar');
    var list = document.querySelector('.postlist');
    if (!bar || !list) return;

    var rows = Array.prototype.slice.call(list.querySelectorAll('.post-row'));
    var buttons = Array.prototype.slice.call(bar.querySelectorAll('.tagbtn'));
    var empty = document.querySelector('.filter-empty');

    function apply(tag, push) {
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.tag === tag));
      });
      var shown = 0;
      rows.forEach(function (r) {
        var tags = (r.dataset.tags || '').split(',').filter(Boolean);
        var match = tag === '*' || tags.indexOf(tag) !== -1;
        r.hidden = !match;
        if (match) shown++;
      });
      if (empty) empty.hidden = shown !== 0;

      if (push) {
        var url = tag === '*'
          ? window.location.pathname
          : window.location.pathname + '?tag=' + encodeURIComponent(tag);
        history.replaceState(null, '', url);
      }
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () { apply(b.dataset.tag, true); });
    });

    var initial = new URLSearchParams(window.location.search).get('tag');
    if (initial && buttons.some(function (b) { return b.dataset.tag === initial; })) {
      apply(initial, false);
    }
  })();

  /* ───────── copy-code buttons ───────── */
  (function copyCode() {
    document.querySelectorAll('.cb-copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var block = btn.closest('.codeblock');
        var code = block && block.querySelector('pre code');
        if (!code) return;
        var text = code.innerText;
        var done = function () {
          var prev = btn.textContent;
          btn.textContent = 'COPIED';
          btn.classList.add('ok');
          setTimeout(function () { btn.textContent = prev; btn.classList.remove('ok'); }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(function () { fallback(text, done); });
        } else {
          fallback(text, done);
        }
      });
    });

    function fallback(text, done) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* no-op */ }
      ta.remove();
    }
  })();

  /* ───────── copy permalink ───────── */
  (function copyLink() {
    var btn = document.getElementById('copy-link');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var url = window.location.href.split('#')[0];
      var done = function () {
        var prev = btn.querySelector('span').textContent;
        btn.querySelector('span').textContent = 'COPIED';
        btn.classList.add('ok');
        setTimeout(function () { btn.querySelector('span').textContent = prev; btn.classList.remove('ok'); }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () {});
      }
    });
  })();

  /* ───────── reading progress ───────── */
  (function progress() {
    var bar = document.querySelector('.progress');
    var art = document.querySelector('.prose');
    if (!bar || !art) return;
    var ticking = false;
    function update() {
      var rect = art.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var passed = -rect.top;
      var pct = total > 0 ? Math.min(1, Math.max(0, passed / total)) : (rect.top <= 0 ? 1 : 0);
      bar.style.width = (pct * 100).toFixed(2) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  })();

  /* ───────── TOC scrollspy ───────── */
  (function scrollspy() {
    var toc = document.querySelector('.toc');
    if (!toc || !('IntersectionObserver' in window)) return;

    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    if (!links.length) return;

    var map = {};
    var targets = [];
    links.forEach(function (a) {
      var el = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (el) { map[el.id] = a; targets.push(el); }
    });
    if (!targets.length) return;

    var visible = new Set();
    function paint() {
      var active = null;
      for (var i = 0; i < targets.length; i++) {
        if (visible.has(targets[i].id)) { active = targets[i].id; break; }
      }
      if (!active) {
        // nothing intersecting — fall back to the last heading scrolled past
        for (var j = targets.length - 1; j >= 0; j--) {
          if (targets[j].getBoundingClientRect().top < 120) { active = targets[j].id; break; }
        }
      }
      links.forEach(function (a) { a.classList.remove('active'); });
      if (active && map[active]) map[active].classList.add('active');
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) visible.add(en.target.id);
        else visible.delete(en.target.id);
      });
      paint();
    }, { rootMargin: '-96px 0px -70% 0px', threshold: 0 });

    targets.forEach(function (t) { io.observe(t); });
    window.addEventListener('scroll', function () { requestAnimationFrame(paint); }, { passive: true });
    paint();
  })();

  /* ───────── custom cursor (desktop, fine pointer only) ───────── */
  (function initCursor() {
    var mq = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 821px)');
    if (!mq.matches) {
      if (mq.addEventListener) {
        mq.addEventListener('change', function (e) { if (e.matches) initCursor(); }, { once: true });
      }
      return;
    }

    var dot = document.querySelector('.cursor-dot');
    var ret = document.querySelector('.cursor-reticle');
    if (!dot || !ret) return;

    var killed = false;
    var raf = 0;

    function kill() {
      if (killed) return;
      killed = true;
      cancelAnimationFrame(raf);
      dot.style.opacity = ret.style.opacity = '0';
      dot.style.transform = ret.style.transform = 'translate3d(-9999px,-9999px,0)';
      document.body.classList.remove('cur-hover', 'cur-text', 'cur-down', 'cur-out');
    }
    window.addEventListener('touchstart', kill, { once: true, passive: true });
    if (mq.addEventListener) mq.addEventListener('change', function (e) { if (!e.matches) kill(); });

    var mx = -100, my = -100, rx = -100, ry = -100;

    var HOVER_SEL = 'a, button, .post-row, .pn, .tagbtn, .h-eyebrow, [role="button"]';
    var TEXT_SEL = 'input, textarea, [contenteditable="true"]';

    function tick() {
      if (killed) return;
      rx += (mx - rx) * 0.22;
      ry += (my - ry) * 0.22;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0) translate(-50%,-50%)';
      ret.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) translate(-50%,-50%)';
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    var firstMove = true;
    window.addEventListener('mousemove', function (e) {
      if (killed) return;
      mx = e.clientX; my = e.clientY;
      if (firstMove) { rx = mx; ry = my; firstMove = false; document.body.classList.remove('cur-out'); }
    }, { passive: true });

    document.addEventListener('mouseover', function (e) {
      var t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest(TEXT_SEL)) document.body.classList.add('cur-text');
      else document.body.classList.remove('cur-text');
      if (t.closest(HOVER_SEL)) document.body.classList.add('cur-hover');
    });

    document.addEventListener('mouseout', function (e) {
      var t = e.target;
      if (!(t instanceof Element)) return;
      var rel = e.relatedTarget;
      if (t.closest(HOVER_SEL) && !(rel && rel.closest && rel.closest(HOVER_SEL))) {
        document.body.classList.remove('cur-hover');
      }
      if (t.closest(TEXT_SEL) && !(rel && rel.closest && rel.closest(TEXT_SEL))) {
        document.body.classList.remove('cur-text');
      }
    });

    window.addEventListener('mousedown', function (e) {
      if (killed) return;
      document.body.classList.add('cur-down');
      var ping = document.createElement('div');
      ping.className = 'cursor-ping';
      ping.style.setProperty('--x', e.clientX + 'px');
      ping.style.setProperty('--y', e.clientY + 'px');
      document.body.appendChild(ping);
      ping.addEventListener('animationend', function () { ping.remove(); }, { once: true });
      setTimeout(function () { if (ping.isConnected) ping.remove(); }, 900);
    });
    window.addEventListener('mouseup', function () { document.body.classList.remove('cur-down'); });

    document.addEventListener('mouseleave', function () { document.body.classList.add('cur-out'); });
    document.addEventListener('mouseenter', function () { document.body.classList.remove('cur-out'); });
    window.addEventListener('blur', function () { document.body.classList.add('cur-out'); });
    window.addEventListener('focus', function () { document.body.classList.remove('cur-out'); });
  })();
})();
