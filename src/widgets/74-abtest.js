/* Chapter 74: A/B tests end to end. Duration calculator, SRM checker, peeking simulator. */

/* Accurate erfc for small p-values: series below 2.5, continued fraction above. */
function abErfc(x) {
  if (x < 0) return 2 - abErfc(-x);
  if (x < 2.5) {
    var term = x, s = x, n = 0;
    while (Math.abs(term) > 1e-17 * Math.abs(s) && n < 200) { n++; term *= -x * x / n; s += term / (2 * n + 1); }
    return 1 - 2 / Math.sqrt(Math.PI) * s;
  }
  var k = x;
  for (var i = 80; i >= 1; i--) k = x + (i / 2) / k;
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / k;
}
function abPfmt(p) { return p < 1e-4 ? G.sci(p) : G.fmt(p, 4); }

G.widget('w-ab-dur', function (root) {
  var sp = G.$(root, '#ab-du-p'), sm = G.$(root, '#ab-du-m'), su = G.$(root, '#ab-du-u'), sa = G.$(root, '#ab-du-a'), sc = G.$(root, '#ab-du-c');
  var cv = G.$(root, 'canvas'), ZS = 1.959964 + 0.841621;
  function draw() {
    var P = G.pal(), p = +sp.value / 100, m = +sm.value / 100, users = +su.value, alloc = +sa.value / 100, vk = +sc.value;
    G.$(root, '#ab-du-p-o').textContent = G.pct(p); G.$(root, '#ab-du-m-o').textContent = G.fmt(m * 100, 1) + '%'; G.$(root, '#ab-du-a-o').textContent = G.pct(alloc);
    var v = p * (1 - p) * vk, d = p * m, n = Math.ceil(2 * ZS * ZS * v / (d * d));
    var perDay = users * alloc / 2, days = Math.ceil(n / perDay), weeks = Math.max(1, Math.ceil(days / 7));
    var mdeAt = function (w) { return ZS * Math.sqrt(2 * v / (perDay * 7 * w)) / p; };
    var c = G.canvas(cv, 240), ctx = c.ctx, pad = { l: 52, r: 14, t: 26, b: 36 };
    var top = Math.max(mdeAt(1), m) * 1.18;
    var ystep = top > 0.4 ? 0.1 : top > 0.2 ? 0.05 : top > 0.08 ? 0.02 : top > 0.04 ? 0.01 : top > 0.02 ? 0.005 : 0.002;
    var yt = []; for (var t = 0; t <= top + 1e-9; t += ystep) yt.push(t);
    var s = G.axes(ctx, c.w, c.h, pad, { x: [0.4, 8.6], y: [0, top], xt: [1, 2, 3, 4, 5, 6, 7, 8], yt: yt, yf: function (t) { return G.fmt(t * 100, ystep < 0.01 ? 1 : 0) + '%'; }, xl: 'weeks of running', yl: 'smallest detectable relative lift' });
    var bw = Math.min(46, (s.X(2) - s.X(1)) * 0.6);
    for (var w = 1; w <= 8; w++) {
      var mv = Math.min(mdeAt(w), top), ok = mdeAt(w) <= m;
      ctx.fillStyle = ok ? P.good : P.tn; ctx.globalAlpha = ok ? 0.85 : 0.45;
      ctx.fillRect(s.X(w) - bw / 2, s.Y(mv), bw, s.Y(0) - s.Y(mv)); ctx.globalAlpha = 1;
    }
    G.line(ctx, [[pad.l, s.Y(m)], [c.w - pad.r, s.Y(m)]], P.accent, 2, [6, 4]);
    var tl = 'your target ' + G.fmt(m * 100, 1) + '%'; ctx.font = '12px ' + G.css('--font-body', 'sans-serif');
    var tw = ctx.measureText(tl).width; ctx.fillStyle = P.surface; ctx.fillRect(c.w - pad.r - tw - 8, s.Y(m) - 17, tw + 8, 16);
    G.text(ctx, tl, c.w - pad.r - 4, s.Y(m) - 9, P.accent, 'right', 12);
    G.$(root, '[data-n]').textContent = G.big(n);
    G.$(root, '[data-d]').textContent = G.big(days);
    G.$(root, '[data-w]').textContent = weeks * 7 + ' days';
    G.$(root, '[data-abs]').textContent = G.fmt(d * 100, 2);
    var msg = 'Detecting a ' + G.fmt(m * 100, 1) + '% relative lift on a ' + G.pct(p) + ' base means a ' + G.fmt(d * 100, 2) + '-point change. That needs ' + G.big(n) + ' users per arm, or ' + G.big(days) + ' days at ' + G.big(perDay) + ' per arm per day. ';
    if (days > 56) msg += 'That is longer than eight weeks: redesign with a more sensitive metric, CUPED, a triggered population, or a larger MDE.';
    else if (weeks < 2) msg += 'Round up to at least 14 days for any change users can notice, to cover novelty and two of each weekday.';
    else msg += 'Round up to ' + weeks * 7 + ' days so every weekday appears equally often in both arms.';
    G.$(root, '[data-out]').textContent = msg;
  }
  G.on([sp, sm, sa], 'input', draw); G.on([su, sc], 'change', draw);
  return draw;
});

G.widget('w-ab-srm', function (root) {
  var ss = G.$(root, '#ab-srm-s'), ia = G.$(root, '#ab-srm-a'), ib = G.$(root, '#ab-srm-b'), cv = G.$(root, 'canvas'), vd = G.$(root, '[data-verdict]');
  var PRE = { ok: [50, 50090, 49910], one: [50, 50500, 49500], bot: [50, 250000, 246500], small: [50, 230, 190] };
  function draw() {
    var P = G.pal(), sh = +ss.value / 100, a = Math.max(0, Math.round(+ia.value || 0)), b = Math.max(0, Math.round(+ib.value || 0)), N = a + b;
    G.$(root, '#ab-srm-s-o').textContent = G.pct(sh);
    var c = G.canvas(cv, 120), ctx = c.ctx;
    if (N < 1) {
      G.text(ctx, 'Enter the counts for both arms.', 16, 60, P.muted);
      vd.style.setProperty('--vc', 'var(--muted)'); vd.innerHTML = 'Waiting for counts';
      return;
    }
    var ea = N * sh, eb = N * (1 - sh), chi = (a - ea) * (a - ea) / ea + (b - eb) * (b - eb) / eb, p = abErfc(Math.sqrt(chi / 2));
    var obs = a / N, sd = Math.sqrt(sh * (1 - sh) / N), band = 3.29 * sd;
    var hw = Math.max(4.5 * sd, Math.abs(obs - sh) * 1.35, 0.0004), x0 = Math.max(0, sh - hw), x1 = Math.min(1, sh + hw);
    var L = 20, R = c.w - 20, X = function (v) { return L + (v - x0) / (x1 - x0) * (R - L); }, y = 62;
    ctx.fillStyle = P.sunk; ctx.fillRect(L, y - 12, R - L, 24);
    ctx.fillStyle = P.good; ctx.globalAlpha = 0.22; ctx.fillRect(X(Math.max(x0, sh - band)), y - 12, X(Math.min(x1, sh + band)) - X(Math.max(x0, sh - band)), 24); ctx.globalAlpha = 1;
    G.line(ctx, [[X(sh), y - 20], [X(sh), y + 20]], P.fg, 1.5, [3, 3]);
    var dec = hw < 0.002 ? 2 : 1;
    [x0, sh, x1].forEach(function (v, i) { G.text(ctx, G.fmt(v * 100, dec) + '%', X(v), y + 34, P.faint, i === 0 ? 'left' : i === 2 ? 'right' : 'center', 11); });
    G.text(ctx, 'shares a fair split gives 99.9% of the time', X(sh), y - 26, P.good, 'center', 12);
    var inside = Math.abs(obs - sh) <= band;
    G.dot(ctx, X(obs), y, 7, inside ? P.good : P.fp, P.surface);
    var lx = X(obs), al = lx > c.w * 0.75 ? 'right' : lx < c.w * 0.25 ? 'left' : 'center';
    G.text(ctx, 'observed ' + G.fmt(obs * 100, dec + 1) + '%', lx, y + 50, inside ? P.good : P.fp, al, 12);
    G.$(root, '[data-sh]').textContent = G.fmt(obs * 100, 2) + '%';
    G.$(root, '[data-ex]').textContent = G.big(Math.round(ea));
    G.$(root, '[data-chi]').textContent = G.fmt(chi, 2);
    G.$(root, '[data-p]').textContent = abPfmt(p);
    var head, body, col;
    var gap = Math.abs(a - Math.round(ea));
    if (p < 0.001) { head = 'Sample ratio mismatch: do not read the results'; col = 'var(--fp)'; body = 'A healthy ' + G.pct(sh) + ' split would be this far off less than once in 1,000 tests. Something is adding or dropping ' + G.big(gap) + ' users unevenly. Check crashes and timeouts in treatment, bot filters, triggering, and per-day and per-platform splits before looking at any metric.'; }
    else if (p < 0.01) { head = 'Borderline: investigate before trusting'; col = 'var(--lead)'; body = 'Not past a strict alarm threshold, but unusual. Look at the split by day and by platform; a leak in one slice can hide in the total.'; }
    else { head = 'No evidence of SRM'; col = 'var(--good)'; body = 'This imbalance is ordinary randomness (p = ' + abPfmt(p) + ').' + (N < 5000 && Math.abs(obs - sh) > 0.02 ? ' But with only ' + G.big(N) + ' users the check is weak: a ' + G.fmt(Math.abs(obs - sh) * 100, 1) + '-point gap passes here and would fail at scale.' : ' You can go on to read the metrics.'); }
    vd.style.setProperty('--vc', col); vd.innerHTML = head + '<span>' + body + '</span>';
  }
  G.$$(root, '[data-preset]').forEach(function (bt) {
    G.on(bt, 'click', function () { var v = PRE[bt.dataset.preset]; ss.value = v[0]; ia.value = v[1]; ib.value = v[2]; ss.dispatchEvent(new Event('input')); });
  });
  G.on([ss, ia, ib], 'input', draw);
  return draw;
});

G.widget('w-ab-peek', function (root) {
  var sk = G.$(root, '#ab-pk-k'), sb = G.$(root, '#ab-pk-b'), cv = G.$(root, 'canvas');
  var KM = 30, M = 4000, cal = sim(101), ev = sim(202), ZC = 1.96;
  function sim(seed) {
    var r = G.rng(seed), z = new Float64Array(M * KM);
    for (var i = 0; i < M; i++) { var s = 0; for (var k = 0; k < KM; k++) { s += G.gauss(r); z[i * KM + k] = s / Math.sqrt(k + 1); } }
    return z;
  }
  function q95(a) { a.sort(); return a[Math.floor(0.95 * a.length)]; }
  var naive = [0], fixed = [0], cP = [0], cO = [0], fP = [0], fO = [0];
  (function precompute() {
    for (var K = 1; K <= KM; K++) {
      var mp = new Float64Array(M), mo = new Float64Array(M), i, k, x;
      for (i = 0; i < M; i++) { var a = 0, b = 0; for (k = 0; k < K; k++) { x = Math.abs(cal[i * KM + k]); if (x > a) a = x; x *= Math.sqrt((k + 1) / K); if (x > b) b = x; } mp[i] = a; mo[i] = b; }
      cP.push(q95(mp)); cO.push(q95(mo));
      var nn = 0, ff = 0, pp = 0, oo = 0;
      for (i = 0; i < M; i++) {
        var hn = false, hp = false, ho = false;
        for (k = 0; k < K; k++) { x = Math.abs(ev[i * KM + k]); if (x > ZC) hn = true; if (x > cP[K]) hp = true; if (x > cO[K] * Math.sqrt(K / (k + 1))) ho = true; }
        nn += hn; pp += hp; oo += ho; ff += Math.abs(ev[i * KM + K - 1]) > ZC;
      }
      naive.push(nn / M); fixed.push(ff / M); fP.push(pp / M); fO.push(oo / M);
    }
  })();
  function draw() {
    var P = G.pal(), K = +sk.value, obf = sb.value === 'obf';
    G.$(root, '#ab-pk-k-o').textContent = K;
    var narrow = (cv.parentElement.clientWidth || 640) < 620, H = narrow ? 540 : 300;
    var c = G.canvas(cv, H), ctx = c.ctx;
    var w1 = narrow ? c.w : c.w * 0.58, h1 = narrow ? 290 : H;
    var bnd = function (k) { return obf ? cO[K] * Math.sqrt(K / k) : cP[K]; };
    var pad = { l: 40, r: narrow ? 12 : 22, t: 24, b: 34 };
    var s = G.axes(ctx, w1, h1, pad, { x: [K > 1 ? 1 : 0.5, K > 1 ? K : 1.5], y: [-3.6, 3.6], yt: [-3, -1.96, 0, 1.96, 3], yf: function (t) { return t === 0 ? '0' : G.fmt(t, Math.abs(t) === 3 ? 0 : 2); }, xt: K > 1 ? [1, Math.max(2, Math.round(K / 2)), K] : [1], xl: 'look (day)', yl: 'z' });
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, w1 - pad.l - pad.r, h1 - pad.t - pad.b); ctx.clip();
    ctx.fillStyle = P.warn; ctx.globalAlpha = 0.08;
    ctx.fillRect(pad.l, s.Y(3.6), w1 - pad.l - pad.r, s.Y(ZC) - s.Y(3.6)); ctx.fillRect(pad.l, s.Y(-ZC), w1 - pad.l - pad.r, s.Y(-3.6) - s.Y(-ZC)); ctx.globalAlpha = 1;
    var show = 40, cross = 0;
    for (var pass = 0; pass < 2; pass++) for (var i = 0; i < show; i++) {
      var pts = [], first = -1;
      for (var k = 0; k < K; k++) { var z = Math.max(-3.6, Math.min(3.6, ev[i * KM + k])); pts.push([s.X(k + 1), s.Y(z)]); if (first < 0 && Math.abs(ev[i * KM + k]) > ZC) first = k; }
      if ((first >= 0) !== (pass === 1)) continue;
      if (pass === 1) cross++;
      ctx.globalAlpha = pass ? 0.95 : 0.4;
      if (K === 1) G.dot(ctx, pts[0][0], pts[0][1], 3, pass ? P.fp : P.tn);
      else G.line(ctx, pts, pass ? P.fp : P.tn, pass ? 1.6 : 1, null);
      if (pass === 1 && K > 1) G.dot(ctx, pts[first][0], pts[first][1], 3.2, P.fp);
      ctx.globalAlpha = 1;
    }
    G.line(ctx, [[pad.l, s.Y(ZC)], [w1 - pad.r, s.Y(ZC)]], P.warn, 1.5, [5, 4]);
    G.line(ctx, [[pad.l, s.Y(-ZC)], [w1 - pad.r, s.Y(-ZC)]], P.warn, 1.5, [5, 4]);
    var bu = [], bl = [];
    if (K === 1) { bu = [[pad.l, s.Y(bnd(1))], [w1 - pad.r, s.Y(bnd(1))]]; bl = [[pad.l, s.Y(-bnd(1))], [w1 - pad.r, s.Y(-bnd(1))]]; }
    else for (var kk = 1; kk <= K; kk += (K > 12 ? 0.25 : 0.1)) { bu.push([s.X(kk), s.Y(Math.min(3.8, bnd(kk)))]); bl.push([s.X(kk), s.Y(Math.max(-3.8, -bnd(kk)))]); }
    G.line(ctx, bu, P.accent, 2.4); G.line(ctx, bl, P.accent, 2.4);
    ctx.restore();
    G.text(ctx, cross + ' of ' + show + ' paths shown crossed ±1.96', pad.l + 4, 12, P.fp, 'left', 12);
    // FPR vs number of looks
    var ox = narrow ? 0 : w1, oy = narrow ? h1 : 0, w2 = narrow ? c.w : c.w - w1, h2 = narrow ? H - h1 : H;
    ctx.save(); ctx.translate(ox, oy);
    var pad2 = { l: 48, r: 12, t: 24, b: 34 };
    var s2 = G.axes(ctx, w2, h2, pad2, { x: [1, KM], y: [0, 0.4], xt: [1, 10, 20, 30], yt: [0, 0.05, 0.1, 0.2, 0.3, 0.4], yf: function (t) { return G.pct(t); }, xl: 'number of looks', yl: 'false positive rate' });
    var sq = obf ? fO : fP, ln = [], ls = [];
    for (var j = 1; j <= KM; j++) { ln.push([s2.X(j), s2.Y(naive[j])]); ls.push([s2.X(j), s2.Y(sq[j])]); }
    G.line(ctx, [[s2.X(1), s2.Y(0.05)], [s2.X(KM), s2.Y(0.05)]], P.faint, 1, [4, 3]);
    G.line(ctx, ln, P.fp, 2.4); G.line(ctx, ls, P.accent, 2.4);
    G.line(ctx, [[s2.X(K), s2.Y(0)], [s2.X(K), s2.Y(0.4)]], P.faint, 1, [2, 3]);
    G.dot(ctx, s2.X(K), s2.Y(naive[K]), 5, P.fp, P.surface); G.dot(ctx, s2.X(K), s2.Y(sq[K]), 5, P.accent, P.surface);
    G.text(ctx, 'naive', s2.X(KM) - 2, s2.Y(naive[KM]) - 12, P.fp, 'right', 12);
    G.text(ctx, 'sequential', s2.X(KM) - 2, s2.Y(sq[KM]) - 12, P.accent, 'right', 12);
    ctx.restore();
    G.$(root, '[data-naive]').textContent = G.pct(naive[K], 1);
    G.$(root, '[data-seq]').textContent = G.pct(sq[K], 1);
    G.$(root, '[data-fixed]').textContent = G.pct(fixed[K], 1);
    G.$(root, '[data-bar]').textContent = G.fmt(bnd(K), 2);
    var ratio = naive[K] / 0.05;
    G.$(root, '[data-out]').innerHTML = K === 1
      ? 'With a single look, every method is the same test and the false positive rate is the promised 5%. Add looks to see what peeking costs.'
      : 'Checking ' + K + ' times and stopping at the first p &lt; 0.05 declares a winner in <b>' + G.pct(naive[K], 1) + '</b> of tests where nothing changed, ' + G.fmt(ratio, 1) + ' times the 5% you promised. ' +
        (obf ? 'The O’Brien–Fleming-shaped boundary demands z above ' + G.fmt(bnd(1), 1) + ' on the first look and ' + G.fmt(bnd(K), 2) + ' on the last, close to the usual 1.96, so you lose little power if you run to the end.'
             : 'The Pocock-shaped boundary uses z above ' + G.fmt(bnd(K), 2) + ' at every look. Early stopping is easier than with O’Brien–Fleming, but the final look is stricter, which costs power if the test runs to the end.') +
        ' Either way the false positive rate stays near ' + G.pct(sq[K], 1) + ' (boundaries calibrated by simulation on separate paths).';
  }
  G.on(sk, 'input', draw); G.on(sb, 'change', draw);
  return draw;
});
