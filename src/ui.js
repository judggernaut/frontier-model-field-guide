/* Page chrome: theme toggle, layer filter, jump menu, scroll spy, progress. Runs after all widgets are registered. */
(function () {
  var root = document.documentElement, body = document.body;
  try { var t = localStorage.getItem('guide-theme'); if (t) root.setAttribute('data-theme', t); } catch (e) {}
  var tt = document.getElementById('tt');
  if (tt) tt.addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') === 'dark' || (!root.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var n = dark ? 'light' : 'dark'; root.setAttribute('data-theme', n);
    try { localStorage.setItem('guide-theme', n); } catch (e) {}
    G.redraw();
  });
  if (window.matchMedia) { var mq = window.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', function () { G.redraw(); }); }

  var lbtns = Array.prototype.slice.call(document.querySelectorAll('.layers button'));
  function setLayer(v) {
    body.classList.remove('only-eli5', 'only-lead', 'only-deep');
    if (v !== 'all') body.classList.add('only-' + v);
    lbtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.layer === v ? 'true' : 'false'); });
    try { localStorage.setItem('guide-layer', v); } catch (e) {}
    setTimeout(G.redraw, 30);
  }
  lbtns.forEach(function (b) { b.addEventListener('click', function () { setLayer(b.dataset.layer); }); });
  try { var sl = localStorage.getItem('guide-layer'); if (sl) setLayer(sl); } catch (e) {}

  var secs = Array.prototype.slice.call(document.querySelectorAll('main section[id], main .part-head[id]'));
  var jp = document.getElementById('jp'), links = Array.prototype.slice.call(document.querySelectorAll('nav.rail a'));
  if (jp) jp.addEventListener('change', function () { var e = document.getElementById(jp.value); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  var pf = document.getElementById('pf'), ticking = false, last = -1;
  function current() { var y = window.scrollY + 110, idx = 0; for (var i = 0; i < secs.length; i++) if (secs[i].offsetTop <= y) idx = i; return idx; }
  function onScroll() {
    var i = current();
    if (i !== last) {
      last = i; var id = secs[i] && secs[i].id;
      if (jp && id && jp.querySelector('option[value="' + id + '"]')) jp.value = id;
      links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + id); });
    }
    var m = document.body.scrollHeight - window.innerHeight;
    if (pf) pf.style.width = (m > 0 ? Math.min(100, window.scrollY / m * 100) : 0) + '%';
  }
  window.addEventListener('scroll', function () { if (ticking) return; ticking = true; requestAnimationFrame(function () { onScroll(); ticking = false; }); }, { passive: true });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(G.redraw, 150); });
  G.boot();
  onScroll();
  window.addEventListener('beforeprint', function () { G.redraw(); });
})();
