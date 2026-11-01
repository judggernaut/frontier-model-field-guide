/* Page chrome and shared components:
   theme toggle, depth tabs (groups each run of Plain/Leader/Deep layers into shadcn-style tabs), visual stories (step-through diagrams),
   command menu (Cmd/Ctrl+K), slider fill, code copy, scroll spy and progress. Runs after every widget has registered. */
(function () {
  var root = document.documentElement, body = document.body;
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------- theme ---------- */
  var t = store('guide-theme'); if (t) root.setAttribute('data-theme', t);
  function isDark() { return root.getAttribute('data-theme') === 'dark' || (!root.getAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
  var sun = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
  var tt = document.getElementById('tt');
  function themeIcon() { if (tt) tt.innerHTML = isDark() ? sun : moon; }
  themeIcon();
  if (tt) tt.addEventListener('click', function () {
    var n = isDark() ? 'light' : 'dark'; root.setAttribute('data-theme', n); store('guide-theme', n); themeIcon(); G.redraw();
  });
  if (window.matchMedia) { var mq = window.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', function () { themeIcon(); G.redraw(); }); }

  /* ---------- depth tabs ---------- */
  var NAMES = { eli5: 'Plain words', lead: 'For leaders', deep: 'Under the hood' };
  var COLORS = { eli5: 'var(--eli5)', lead: 'var(--lead)', deep: 'var(--deep)' };
  function kindOf(el) { return el.classList.contains('eli5') ? 'eli5' : el.classList.contains('lead') ? 'lead' : el.classList.contains('deep') ? 'deep' : null; }
  var groups = [];
  $$('main .layer').forEach(function (el) {
    if (el.__grouped) return;
    var run = [el], n = el.nextElementSibling;
    while (n && n.classList && n.classList.contains('layer') && kindOf(n)) { run.push(n); n = n.nextElementSibling; }
    if (run.length < 2) return;
    var box = document.createElement('div'); box.className = 'ltabs';
    var tl = document.createElement('div'); tl.className = 'tl';
    var list = document.createElement('div'); list.className = 'tlist'; list.setAttribute('role', 'tablist');
    tl.appendChild(list);
    el.parentNode.insertBefore(box, el); box.appendChild(tl);
    var g = { box: box, panels: [], btns: [] };
    run.forEach(function (p) {
      p.__grouped = true; box.appendChild(p);
      var k = kindOf(p), b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.k = k;
      b.innerHTML = '<i style="background:' + COLORS[k] + '"></i>' + NAMES[k];
      b.addEventListener('click', function () { select(g, k); setTimeout(G.redraw, 20); });
      list.appendChild(b); g.panels.push(p); g.btns.push(b);
    });
    var hint = document.createElement('span'); hint.className = 'hint'; tl.appendChild(hint);
    groups.push(g);
  });
  function select(g, k) {
    var has = g.panels.some(function (p) { return kindOf(p) === k; }); if (!has) k = kindOf(g.panels[0]);
    g.panels.forEach(function (p) { var on = kindOf(p) === k; p.hidden = !on; p.classList.toggle('on', on); });
    g.btns.forEach(function (b) { b.setAttribute('aria-selected', b.dataset.k === k ? 'true' : 'false'); });
    var p = g.panels.filter(function (x) { return kindOf(x) === k; })[0], lt = p && p.querySelector('.lt');
    g.box.querySelector('.hint').textContent = '';
  }
  var singles = $$('main .layer').filter(function (el) { return !el.__grouped && kindOf(el); });
  singles.forEach(function (el) {
    var lh = el.querySelector('.lh'); if (!lh) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'b showbtn noprint'; b.textContent = 'Show';
    b.addEventListener('click', function () { el.classList.toggle('open'); b.textContent = el.classList.contains('open') ? 'Hide' : 'Show'; setTimeout(G.redraw, 20); });
    lh.appendChild(b);
  });
  var lbtns = $$('.layers button');
  function setLayer(v) {
    body.classList.toggle('stack', v === 'all');
    if (v !== 'all') groups.forEach(function (g) { select(g, v); });
    singles.forEach(function (el) { var c = v !== 'all' && kindOf(el) !== v; el.classList.toggle('folded', c); if (!c) el.classList.remove('open'); var sb = el.querySelector('.showbtn'); if (sb) sb.textContent = 'Show'; });
    lbtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.layer === v ? 'true' : 'false'); });
    store('guide-layer', v);
    setTimeout(G.redraw, 30);
  }
  lbtns.forEach(function (b) { b.addEventListener('click', function () { setLayer(b.dataset.layer); }); });
  var sl = store('guide-layer'); setLayer(sl && /^(eli5|lead|deep|all)$/.test(sl) ? sl : 'eli5');
  window.addEventListener('beforeprint', function () { body.classList.add('stack'); G.redraw(); });

  /* ---------- visual stories ---------- */
  $$('.story').forEach(function (st) {
    var steps = $$('.step', st); if (!steps.length) return;
    var stage = document.createElement('div'); stage.className = 'stage';
    steps[0].parentNode.insertBefore(stage, steps[0]);
    steps.forEach(function (s) { stage.appendChild(s); });
    var nav = document.createElement('div'); nav.className = 'nav noprint';
    nav.innerHTML = '<button type="button" class="b" data-a="prev" aria-label="Previous step">← Back</button>' +
      '<div class="dots"></div><span class="cnt"></span>' +
      '<button type="button" class="b" data-a="play" aria-label="Play">▶ Play</button>' +
      '<button type="button" class="b primary" data-a="next">Next →</button>';
    st.appendChild(nav);
    var dots = nav.querySelector('.dots'), cnt = nav.querySelector('.cnt'), play = nav.querySelector('[data-a=play]'), next = nav.querySelector('[data-a=next]');
    steps.forEach(function (s, i) { var d = document.createElement('button'); d.type = 'button'; d.setAttribute('aria-label', 'Step ' + (i + 1)); d.addEventListener('click', function () { stop(); go(i); }); dots.appendChild(d); });
    var cur = 0, timer = null;
    function go(i) {
      cur = (i + steps.length) % steps.length;
      steps.forEach(function (s, j) { s.classList.toggle('on', j === cur); });
      $$('button', dots).forEach(function (d, j) { d.classList.toggle('on', j === cur); });
      cnt.textContent = (cur + 1) + ' / ' + steps.length;
      next.textContent = cur === steps.length - 1 ? 'Start over ↺' : 'Next →';
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; play.textContent = '▶ Play'; } }
    nav.addEventListener('click', function (e) {
      var a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'prev') { stop(); go(cur - 1); }
      if (a.dataset.a === 'next') { stop(); go(cur + 1); }
      if (a.dataset.a === 'play') {
        if (timer) stop(); else { play.textContent = '❚❚ Pause'; if (cur === steps.length - 1) go(0); timer = setInterval(function () { if (cur === steps.length - 1) stop(); else go(cur + 1); }, 4200); }
      }
    });
    st.tabIndex = -1;
    st.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { stop(); go(cur + 1); } if (e.key === 'ArrowLeft') { stop(); go(cur - 1); } });
    go(0);
  });

  /* ---------- slider fill ---------- */
  function fill(r) { var mn = +r.min || 0, mx = +r.max || 100, v = +r.value; r.style.setProperty('--p', ((v - mn) / (mx - mn || 1) * 100) + '%'); }
  function fillAll() { $$('input[type=range]').forEach(fill); }
  document.addEventListener('input', function (e) { if (e.target.type === 'range') fill(e.target); }, true);
  document.addEventListener('click', function () { requestAnimationFrame(fillAll); }, true);

  /* ---------- code copy ---------- */
  $$('pre.code').forEach(function (pre) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'copy noprint'; b.textContent = 'Copy';
    b.addEventListener('click', function () {
      var txt = pre.querySelector('code').innerText;
      function ok() { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1400); }
      try { navigator.clipboard.writeText(txt).then(ok, function () { sel(); }); } catch (e) { sel(); }
      function sel() { var r = document.createRange(); r.selectNodeContents(pre.querySelector('code')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selected'; }
    });
    pre.appendChild(b);
  });

  /* ---------- command menu ---------- */
  function slug(s) { return s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48); }
  var index = [];
  $$('main section[id]').forEach(function (sec) {
    var h2 = sec.querySelector('h2'), chap = sec.querySelector('.sn');
    var title = h2 ? h2.textContent.trim() : sec.id;
    index.push({ g: 'Chapters', t: title, s: chap ? chap.textContent : '', el: sec });
    $$('h3', sec).forEach(function (h) { if (!h.id) h.id = sec.id + '--' + slug(h.textContent); index.push({ g: 'Topics', t: h.textContent.trim(), s: title, el: h }); });
    $$('.widget .wtitle', sec).forEach(function (w) { index.push({ g: 'Interactive', t: w.textContent.replace(/^Interactive/, '').trim(), s: title, el: w.closest('.widget') }); });
    $$('.story .story-title', sec).forEach(function (w) { index.push({ g: 'Visual guides', t: w.textContent.trim(), s: title, el: w.closest('.story') }); });
  });
  $$('.glossary .gl').forEach(function (r) { var dt = r.querySelector('dt'); index.push({ g: 'Glossary', t: dt.textContent, s: (r.querySelector('dd').textContent || '').slice(0, 70), el: r, gl: true }); });
  var cmdk = document.createElement('div'); cmdk.className = 'cmdk noprint'; cmdk.hidden = true;
  cmdk.innerHTML = '<div class="box" role="dialog" aria-label="Search the guide"><div class="in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input id="cmdk-q" placeholder="Search chapters, topics, widgets, terms…" autocomplete="off"><span class="kbd">Esc</span></div><div class="list"></div><div class="foot"><span><span class="kbd">↑</span> <span class="kbd">↓</span> to move</span><span><span class="kbd">↵</span> to open</span></div></div>';
  body.appendChild(cmdk);
  var q = cmdk.querySelector('input'), list = cmdk.querySelector('.list'), results = [], selI = 0;
  function render() {
    var v = q.value.toLowerCase().trim(), words = v.split(/\s+/).filter(Boolean);
    results = index.filter(function (it) { var h = (it.t + ' ' + it.s).toLowerCase(); return words.every(function (w) { return h.indexOf(w) >= 0; }); });
    if (!v) results = index.filter(function (it) { return it.g === 'Chapters'; });
    results = results.slice(0, 60); selI = 0;
    if (!results.length) { list.innerHTML = '<div class="empty">No matches. Try another word.</div>'; return; }
    var html = '', lastG = '';
    results.forEach(function (it, i) {
      if (it.g !== lastG) { html += '<div class="grp">' + it.g + '</div>'; lastG = it.g; }
      html += '<div class="it" data-i="' + i + '"><span>' + it.t.replace(/</g, '&lt;') + '</span><small>' + (it.s || '').replace(/</g, '&lt;').slice(0, 46) + '</small></div>';
    });
    list.innerHTML = html; mark();
  }
  function mark() { $$('.it', list).forEach(function (e) { e.classList.toggle('sel', +e.dataset.i === selI); }); var s = list.querySelector('.it.sel'); if (s) s.scrollIntoView({ block: 'nearest' }); }
  function open() { cmdk.hidden = false; q.value = ''; render(); setTimeout(function () { q.focus(); }, 10); }
  function close() { cmdk.hidden = true; }
  function choose(i) {
    var it = results[i]; if (!it) return; close();
    if (it.gl) { var gq = document.getElementById('glq'); if (gq) { gq.value = it.t; gq.dispatchEvent(new Event('input')); } }
    var lay = it.el.closest && it.el.closest('.ltabs > .layer');
    if (lay && lay.hidden) { var g = groups.filter(function (x) { return x.box === lay.parentNode; })[0]; if (g) select(g, kindOf(lay)); }
    it.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  q.addEventListener('input', render);
  q.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { selI = Math.min(results.length - 1, selI + 1); mark(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { selI = Math.max(0, selI - 1); mark(); e.preventDefault(); }
    if (e.key === 'Enter') { choose(selI); e.preventDefault(); }
    if (e.key === 'Escape') close();
  });
  list.addEventListener('click', function (e) { var it = e.target.closest('.it'); if (it) choose(+it.dataset.i); });
  cmdk.addEventListener('click', function (e) { if (e.target === cmdk) close(); });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdk.hidden ? open() : close(); }
    else if (e.key === '/' && cmdk.hidden && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
    else if (e.key === 'Escape' && !cmdk.hidden) close();
  });
  var sb = document.getElementById('searchbtn'); if (sb) sb.addEventListener('click', open);

  /* ---------- scroll spy and progress ---------- */
  var secs = $$('main section[id], main .part-head[id]');
  var links = $$('nav.rail a');
  var pf = document.getElementById('pf'), ticking = false, last = -1;
  function current() { var y = window.scrollY + 120, idx = 0; for (var i = 0; i < secs.length; i++) if (secs[i].offsetTop <= y) idx = i; return idx; }
  function onScroll() {
    var i = current();
    if (i !== last) {
      last = i; var id = secs[i] && secs[i].id;
      links.forEach(function (a) { var on = a.getAttribute('href') === '#' + id; a.classList.toggle('on', on); if (on && a.scrollIntoViewIfNeeded) a.scrollIntoViewIfNeeded(false); });
    }
    var m = document.body.scrollHeight - window.innerHeight;
    if (pf) pf.style.width = (m > 0 ? Math.min(100, window.scrollY / m * 100) : 0) + '%';
  }
  window.addEventListener('scroll', function () { if (ticking) return; ticking = true; requestAnimationFrame(function () { onScroll(); ticking = false; }); }, { passive: true });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(G.redraw, 150); });
  G.boot();
  fillAll();
  var _r = G.redraw; G.redraw = function () { _r(); fillAll(); };
  onScroll();
})();
