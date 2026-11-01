
/* ---------- shared helpers ---------- */
function css(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n); return (v && v.trim()) || f; }
function pal() {
  return { ink: css('--ink', '#1c1b19'), muted: css('--muted', '#666'), line: css('--line', '#ddd'),
           accent: css('--accent', '#c2603f'), a2: css('--blue', '#4a86c8'), a3: css('--green', '#5e9e6a'),
           warn: css('--warn', '#d99a4e'), bg: css('--bg', '#fff') };
}
function mul(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function fmt(x, d) { d = d === undefined ? 2 : d; if (!isFinite(x)) return '-'; return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
function qtl(s, q) { return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))] : 0; }
function sd(a) { var m = mean(a); return Math.sqrt(a.reduce(function (x, y) { return x + (y - m) * (y - m); }, 0) / (a.length - 1)); }
function cv(el, h) {
  var dpr = window.devicePixelRatio || 1, w = el.parentElement.clientWidth || 620;
  el.style.width = '100%'; el.style.height = h + 'px';
  el.width = Math.floor(w * dpr); el.height = Math.floor(h * dpr);
  var c = el.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  return { c: c, w: w, h: h };
}
function frame(c, w, h, p, xl, yl, P) {
  c.strokeStyle = P.line; c.lineWidth = 1; c.beginPath();
  c.moveTo(p.l, p.t); c.lineTo(p.l, h - p.b); c.lineTo(w - p.r, h - p.b); c.stroke();
  c.fillStyle = P.muted; c.font = '11px ui-sans-serif,system-ui,sans-serif';
  if (xl) { c.textAlign = 'center'; c.fillText(xl, (p.l + w - p.r) / 2, h - 4); }
  if (yl) { c.save(); c.translate(12, (p.t + h - p.b) / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillText(yl, 0, 0); c.restore(); }
}
function hist(c, data, p, w, h, bins, color, lo, hi) {
  var counts = new Array(bins).fill(0);
  data.forEach(function (v) { if (v >= lo && v <= hi) counts[Math.min(bins - 1, Math.floor((v - lo) / (hi - lo) * bins))]++; });
  var mx = Math.max.apply(null, counts) || 1, pw = (w - p.l - p.r) / bins;
  c.fillStyle = color;
  for (var i = 0; i < bins; i++) { var bh = (counts[i] / mx) * (h - p.t - p.b); c.fillRect(p.l + i * pw, h - p.b - bh, Math.max(1, pw - 1), bh); }
}
function mark(c, x, p, w, h, lo, hi, col, lab, dy) {
  var px = p.l + (x - lo) / (hi - lo) * (w - p.l - p.r);
  if (px < p.l || px > w - p.r) return;
  c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(px, p.t); c.lineTo(px, h - p.b); c.stroke();
  c.fillStyle = col; c.font = '600 11px ui-sans-serif,system-ui,sans-serif'; c.textAlign = 'left';
  c.fillText(lab, Math.min(px + 4, w - 78), p.t + 12 + (dy || 0));
}

/* ---------- samplers ---------- */
function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function poissonDraw(r, l) { if (l > 60) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss(r))); var L = Math.exp(-l), k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; }
function gammaDraw(r, shape) { var g = 0, n = Math.max(1, Math.round(shape)); for (var i = 0; i < n; i++) g += -Math.log(1 - r()); return g; }

var DISTS = {
  bernoulli:  { name: 'Bernoulli', p1: ['probability of pass', 0.05, 0.95, 0.05, 0.7], p2: null, discrete: true,
                draw: function (r, a) { return r() < a ? 1 : 0; } },
  binomial:   { name: 'Binomial', p1: ['trials n', 5, 100, 1, 40], p2: ['pass probability', 0.05, 0.95, 0.05, 0.4], discrete: true,
                draw: function (r, a, b) { var c = 0; for (var i = 0; i < a; i++) if (r() < b) c++; return c; } },
  uniform:    { name: 'Uniform', p1: ['low', 0, 5, 0.5, 0], p2: ['high', 1, 20, 0.5, 1], discrete: false,
                draw: function (r, a, b) { return a + r() * (b - a); } },
  normal:     { name: 'Normal', p1: ['mean', -5, 20, 0.5, 5], p2: ['standard deviation', 0.2, 8, 0.2, 1.5], discrete: false,
                draw: function (r, a, b) { return a + b * gauss(r); } },
  t:          { name: "Student's t", p1: ['degrees of freedom', 1, 40, 1, 3], p2: null, discrete: false,
                draw: function (r, a) { var z = gauss(r), s = 0; for (var i = 0; i < a; i++) { var g = gauss(r); s += g * g; } return z / Math.sqrt(s / a); } },
  lognormal:  { name: 'Lognormal', p1: ['median scale', 0.5, 10, 0.5, 3], p2: ['log sd (skew)', 0.1, 1.6, 0.05, 0.8], discrete: false,
                draw: function (r, a, b) { return Math.exp(Math.log(a) + b * gauss(r)); } },
  exponential:{ name: 'Exponential', p1: ['mean waiting time', 0.5, 15, 0.5, 3], p2: null, discrete: false,
                draw: function (r, a) { return -a * Math.log(1 - r()); } },
  gamma:      { name: 'Gamma', p1: ['shape (number of steps)', 1, 20, 1, 3], p2: ['scale', 0.5, 6, 0.5, 2], discrete: false,
                draw: function (r, a, b) { return gammaDraw(r, a) * b; } },
  poisson:    { name: 'Poisson', p1: ['rate', 0.5, 30, 0.5, 6], p2: null, discrete: true,
                draw: function (r, a) { return poissonDraw(r, a); } },
  negbinom:   { name: 'Negative binomial', p1: ['shape (lower = more spread)', 1, 20, 1, 2], p2: ['mean', 1, 25, 1, 6], discrete: true,
                draw: function (r, a, b) { var lam = gammaDraw(r, a) * (b / a); return poissonDraw(r, lam); } },
  geometric:  { name: 'Geometric', p1: ['success chance per attempt', 0.05, 0.9, 0.05, 0.35], p2: null, discrete: true,
                draw: function (r, a) { var k = 1; while (r() >= a && k < 200) k++; return k; } },
  beta:       { name: 'Beta', p1: ['passes seen', 1, 100, 1, 8], p2: ['fails seen', 1, 100, 1, 4], discrete: false,
                draw: function (r, a, b) { var x = gammaDraw(r, a), y = gammaDraw(r, b); return x / (x + y); } },
  chisq:      { name: 'Chi square', p1: ['degrees of freedom', 1, 30, 1, 5], p2: null, discrete: false,
                draw: function (r, a) { var s = 0; for (var i = 0; i < a; i++) { var g = gauss(r); s += g * g; } return s; } },
  pareto:     { name: 'Pareto (power law)', p1: ['tail index (lower = heavier)', 0.6, 4, 0.1, 1.4], p2: null, discrete: false,
                draw: function (r, a) { return Math.pow(1 - r(), -1 / a); } },
  mixture:    { name: 'Mixture (two populations)', p1: ['share in the fast group', 0.05, 0.95, 0.05, 0.75], p2: ['separation', 1, 12, 0.5, 6], discrete: false,
                draw: function (r, a, b) { return r() < a ? Math.max(0.05, 1.2 + 0.3 * gauss(r)) : Math.max(0.05, 1.2 + b + 1.5 * gauss(r)); } }
};

/* ---------- W1: distribution explorer ---------- */
function wDist(root) {
  var sel = root.querySelector('[data-k]'), s1 = root.querySelector('[data-p1]'), s2 = root.querySelector('[data-p2]'),
      c1 = root.querySelector('[data-c1]'), c2 = root.querySelector('[data-c2]'),
      out = root.querySelector('[data-out]'), l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]'),
      w1 = root.querySelector('[data-w1]'), w2 = root.querySelector('[data-w2]');
  Object.keys(DISTS).forEach(function (k) {
    var o = document.createElement('option'); o.value = k; o.textContent = DISTS[k].name;
    if (k === 'lognormal') o.selected = true;
    sel.appendChild(o);
  });
  function sync() {
    var D = DISTS[sel.value];
    s1.min = D.p1[1]; s1.max = D.p1[2]; s1.step = D.p1[3]; s1.value = D.p1[4];
    if (D.p2) { w2.style.display = ''; s2.min = D.p2[1]; s2.max = D.p2[2]; s2.step = D.p2[3]; s2.value = D.p2[4]; }
    else w2.style.display = 'none';
  }
  function draw() {
    var P = pal(), D = DISTS[sel.value], a = parseFloat(s1.value), b = D.p2 ? parseFloat(s2.value) : 0;
    l1.textContent = D.p1[0] + ': ' + a;
    if (D.p2) l2.textContent = D.p2[0] + ': ' + b;
    var r = mul(99), data = [];
    for (var i = 0; i < 6000; i++) data.push(D.draw(r, a, b));
    var s = data.slice().sort(function (x, y) { return x - y; });
    var lo = D.discrete ? Math.max(0, s[0] - 0.5) : Math.min(0, qtl(s, 0.001));
    var hi = qtl(s, 0.995) * 1.05 + (D.discrete ? 0.5 : 0.001);
    if (hi <= lo) hi = lo + 1;

    var A = cv(c1, 200), p = { l: 34, r: 14, t: 14, b: 30 };
    frame(A.c, A.w, A.h, p, 'value', 'how often', P);
    hist(A.c, data, p, A.w, A.h, D.discrete ? Math.min(40, Math.round(hi - lo) + 1) : 48, P.line, lo, hi);
    var md = qtl(s, 0.5), mu = mean(data), p95 = qtl(s, 0.95);
    mark(A.c, md, p, A.w, A.h, lo, hi, P.a3, 'median ' + fmt(md), 0);
    mark(A.c, mu, p, A.w, A.h, lo, hi, P.accent, 'mean ' + fmt(mu), 15);
    mark(A.c, p95, p, A.w, A.h, lo, hi, P.warn, 'p95 ' + fmt(p95), 30);

    // CDF
    var B = cv(c2, 140), p2p = { l: 40, r: 14, t: 12, b: 30 };
    frame(B.c, B.w, B.h, p2p, 'value', 'share at or below', P);
    B.c.strokeStyle = P.a2; B.c.lineWidth = 2; B.c.beginPath();
    for (var q = 0; q <= 100; q++) {
      var v = qtl(s, q / 100);
      var X = p2p.l + (v - lo) / (hi - lo) * (B.w - p2p.l - p2p.r);
      var Y = B.h - p2p.b - (q / 100) * (B.h - p2p.t - p2p.b);
      if (q === 0) B.c.moveTo(X, Y); else B.c.lineTo(X, Y);
    }
    B.c.stroke();
    [0.5, 0.95].forEach(function (q) {
      var v = qtl(s, q);
      var X = p2p.l + (v - lo) / (hi - lo) * (B.w - p2p.l - p2p.r);
      var Y = B.h - p2p.b - q * (B.h - p2p.t - p2p.b);
      B.c.fillStyle = q === 0.5 ? P.a3 : P.warn;
      B.c.beginPath(); B.c.arc(X, Y, 4, 0, 7); B.c.fill();
    });

    var v = sd(data) * sd(data), ratio = mu / (md || 1);
    var msg = '';
    if (ratio > 1.25) msg = '<span style="color:' + P.warn + '"><b>Right skewed.</b> mean/median = ' + fmt(ratio) + '. Report the median and percentiles, not the mean.</span>';
    else if (ratio < 0.85) msg = '<span style="color:' + P.warn + '"><b>Left skewed.</b> mean/median = ' + fmt(ratio) + '.</span>';
    else msg = '<span style="color:' + P.a3 + '">Roughly symmetric (mean/median = ' + fmt(ratio) + '). The mean is a fair summary.</span>';
    if (D.discrete && mu > 0 && (v / mu > 1.5)) msg += '<br><span style="color:' + P.warn + '">variance/mean = ' + fmt(v / mu) + '. Overdispersed: Poisson intervals would be too narrow.</span>';
    out.innerHTML = '<b>mean</b> ' + fmt(mu) + ' &nbsp; <b>median</b> ' + fmt(md) + ' &nbsp; <b>sd</b> ' + fmt(Math.sqrt(v)) +
      ' &nbsp; <b>p95</b> ' + fmt(p95) + ' &nbsp; <b>max</b> ' + fmt(s[s.length - 1]) + '<br>' + msg;
  }
  sel.addEventListener('change', function () { sync(); draw(); });
  [s1, s2].forEach(function (e) { e.addEventListener('input', draw); });
  sync(); root._draw = draw; draw();
}

/* ---------- W2: central limit theorem ---------- */
function wClt(root) {
  var sel = root.querySelector('[data-k]'), sn = root.querySelector('[data-n]'),
      c1 = root.querySelector('[data-c1]'), c2 = root.querySelector('[data-c2]'),
      out = root.querySelector('[data-out]'), l1 = root.querySelector('[data-l1]');
  ['lognormal', 'exponential', 'bernoulli', 'pareto', 'uniform', 'mixture'].forEach(function (k) {
    var o = document.createElement('option'); o.value = k; o.textContent = DISTS[k].name;
    if (k === 'lognormal') o.selected = true; sel.appendChild(o);
  });
  function draw() {
    var P = pal(), D = DISTS[sel.value], n = parseInt(sn.value, 10);
    l1.textContent = 'each average uses n = ' + n + ' draws';
    var a = D.p1[4], b = D.p2 ? D.p2[4] : 0, r = mul(5);
    var raw = [], means = [];
    for (var i = 0; i < 8000; i++) raw.push(D.draw(r, a, b));
    for (i = 0; i < 4000; i++) { var s = 0; for (var j = 0; j < n; j++) s += D.draw(r, a, b); means.push(s / n); }
    var sr = raw.slice().sort(function (x, y) { return x - y; });
    var sm = means.slice().sort(function (x, y) { return x - y; });

    var A = cv(c1, 150), p = { l: 30, r: 12, t: 12, b: 28 };
    frame(A.c, A.w, A.h, p, 'a single measurement', '', P);
    hist(A.c, raw, p, A.w, A.h, 50, P.warn, qtl(sr, 0.001), qtl(sr, 0.99));
    var B = cv(c2, 150);
    frame(B.c, B.w, B.h, p, 'the AVERAGE of ' + n + ' measurements', '', P);
    hist(B.c, means, p, B.w, B.h, 50, P.a2, qtl(sm, 0.001), qtl(sm, 0.999));

    var skewRaw = mean(raw) / (qtl(sr, 0.5) || 1), skewM = mean(means) / (qtl(sm, 0.5) || 1);
    out.innerHTML = '<b>Raw data:</b> mean ' + fmt(mean(raw)) + ', median ' + fmt(qtl(sr, 0.5)) +
      ', skew ratio ' + fmt(skewRaw) + '<br><b>Averages of ' + n + ':</b> mean ' + fmt(mean(means)) +
      ', median ' + fmt(qtl(sm, 0.5)) + ', skew ratio ' + fmt(skewM) +
      ', sd ' + fmt(sd(means)) +
      '<br><span style="color:' + P.muted + '">The top shape can be anything at all. The bottom one becomes a bell as n grows, and its spread shrinks like 1/sqrt(n). That is the central limit theorem, and it is why so much of statistics assumes normality even when the raw data is nothing like normal.</span>';
  }
  sel.addEventListener('change', draw); sn.addEventListener('input', draw);
  root._draw = draw; draw();
}

/* ---------- W3: what a confidence interval means ---------- */
function wCi(root) {
  var sn = root.querySelector('[data-n]'), sp = root.querySelector('[data-p]'),
      c1 = root.querySelector('[data-c1]'), out = root.querySelector('[data-out]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]');
  function wil(k, n) { var z = 1.96; if (!n) return [0, 1]; var p = k / n, d = 1 + z * z / n; var c = (p + z * z / (2 * n)) / d; var m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - m), Math.min(1, c + m)]; }
  function draw() {
    var P = pal(), n = parseInt(sn.value, 10), truth = parseFloat(sp.value);
    l1.textContent = 'tasks per experiment: ' + n;
    l2.textContent = 'true pass rate: ' + fmt(truth, 2);
    var r = mul(3), runs = 60, ivs = [], hits = 0;
    for (var i = 0; i < runs; i++) {
      var k = 0; for (var j = 0; j < n; j++) if (r() < truth) k++;
      var iv = wil(k, n); ivs.push(iv);
      if (iv[0] <= truth && truth <= iv[1]) hits++;
    }
    var A = cv(c1, 250), p = { l: 34, r: 14, t: 12, b: 30 };
    frame(A.c, A.w, A.h, p, 'estimated pass rate', '', P);
    var lo = 0, hi = 1, rowH = (A.h - p.t - p.b) / runs;
    ivs.forEach(function (iv, i) {
      var y = p.t + i * rowH + rowH / 2;
      var x0 = p.l + (iv[0] - lo) / (hi - lo) * (A.w - p.l - p.r);
      var x1 = p.l + (iv[1] - lo) / (hi - lo) * (A.w - p.l - p.r);
      var ok = iv[0] <= truth && truth <= iv[1];
      A.c.strokeStyle = ok ? P.a3 : P.warn; A.c.lineWidth = Math.max(1.4, rowH - 1.4);
      A.c.beginPath(); A.c.moveTo(x0, y); A.c.lineTo(x1, y); A.c.stroke();
    });
    var tx = p.l + truth * (A.w - p.l - p.r);
    A.c.strokeStyle = P.ink; A.c.lineWidth = 2; A.c.setLineDash([4, 3]);
    A.c.beginPath(); A.c.moveTo(tx, p.t); A.c.lineTo(tx, A.h - p.b); A.c.stroke(); A.c.setLineDash([]);
    A.c.fillStyle = P.ink; A.c.font = '600 11px ui-sans-serif,system-ui,sans-serif'; A.c.textAlign = 'left';
    A.c.fillText('the truth', Math.min(tx + 5, A.w - 60), p.t + 11);
    out.innerHTML = '<b>' + hits + ' of ' + runs + ' intervals (' + fmt(100 * hits / runs, 0) +
      '%) contain the true rate.</b> Each orange bar is an experiment that got unlucky.' +
      '<br><span style="color:' + P.muted + '">This is what "95% confident" actually means: the PROCEDURE captures the truth 95 times in 100. It is not a 95% chance that the truth is inside the one interval you happen to be looking at. The truth is fixed; the interval is what moves.</span>';
  }
  [sn, sp].forEach(function (e) { e.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ---------- W4: outlier handling comparator ---------- */
function wOutlier(root) {
  var so = root.querySelector('[data-out2]'), sc = root.querySelector('[data-cnt]'),
      sw = root.querySelector('[data-win]'), c1 = root.querySelector('[data-c1]'),
      out = root.querySelector('[data-out]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]'), l3 = root.querySelector('[data-l3]');
  function draw() {
    var P = pal(), mag = parseFloat(so.value), cnt = parseInt(sc.value, 10), wq = parseFloat(sw.value);
    l1.textContent = 'how extreme the outliers are: ' + mag + 'x';
    l2.textContent = 'how many outliers: ' + cnt + ' out of 1000';
    l3.textContent = 'winsorize / trim at percentile: ' + fmt(wq, 2);
    var r = mul(17), base = [];
    for (var i = 0; i < 1000 - cnt; i++) base.push(Math.exp(Math.log(2.5) + 0.6 * gauss(r)));
    var typical = 2.5;
    for (i = 0; i < cnt; i++) base.push(typical * mag * (0.7 + 0.6 * r()));
    var s = base.slice().sort(function (x, y) { return x - y; });
    var cap = qtl(s, wq);
    var floorv = qtl(s, 1 - wq);
    var winsor = base.map(function (v) { return Math.min(v, cap); });
    var trimmed = s.filter(function (v) { return v <= cap && v >= floorv; });
    var geo = Math.exp(mean(base.map(function (v) { return Math.log(v); })));
    var rows = [
      ['raw mean', mean(base), P.warn, 'moves with every outlier'],
      ['median', qtl(s, 0.5), P.a3, 'ignores them entirely'],
      ['trimmed mean', trimmed.length ? mean(trimmed) : 0, P.a2, 'drops the tails'],
      ['winsorized mean', mean(winsor), P.a2, 'caps rather than drops'],
      ['geometric mean', geo, P.a3, 'natural centre on a log scale'],
      ['p95', qtl(s, 0.95), P.accent, 'the tail is the point']
    ];
    var A = cv(c1, 210), p = { l: 128, r: 60, t: 12, b: 30 };
    frame(A.c, A.w, A.h, p, 'estimated centre (seconds)', '', P);
    var mx = Math.max.apply(null, rows.map(function (x) { return x[1]; })) * 1.15 || 1;
    var rh = (A.h - p.t - p.b) / rows.length;
    rows.forEach(function (row, i) {
      var y = p.t + i * rh + 3, bw = (row[1] / mx) * (A.w - p.l - p.r);
      A.c.fillStyle = row[2]; A.c.globalAlpha = 0.85;
      A.c.fillRect(p.l, y, bw, rh - 7); A.c.globalAlpha = 1;
      A.c.fillStyle = P.muted; A.c.font = '11px ui-sans-serif,system-ui,sans-serif'; A.c.textAlign = 'right';
      A.c.fillText(row[0], p.l - 6, y + rh / 2);
      A.c.textAlign = 'left'; A.c.fillStyle = P.ink;
      A.c.fillText(fmt(row[1], 2), p.l + bw + 6, y + rh / 2);
    });
    var spread = Math.max.apply(null, rows.slice(0, 5).map(function (x) { return x[1]; })) /
                 Math.min.apply(null, rows.slice(0, 5).map(function (x) { return x[1]; }));
    out.innerHTML = '<b>' + cnt + ' outliers out of 1000 spread the "centre" estimates by ' + fmt(spread, 2) + 'x.</b>' +
      '<br><span style="color:' + P.muted + '">Notice the median barely moves no matter what you do to the tail, while the raw mean tracks it directly. Before you pick a method, decide whether those ' + cnt + ' points are broken instrumentation (remove them and say so) or slow requests real users actually waited through (keep them and report percentiles).</span>';
  }
  [so, sc, sw].forEach(function (e) { e.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ---------- W5: identify the distribution ---------- */
function wIdentify(root) {
  var btn = root.querySelector('[data-new]'), box = root.querySelector('[data-quiz]'),
      c1 = root.querySelector('[data-c1]'), out = root.querySelector('[data-out]');
  var pool = ['lognormal', 'normal', 'poisson', 'negbinom', 'exponential', 'binomial', 'mixture', 'uniform', 'pareto', 'geometric'];
  var HINTS = {
    lognormal: 'Right skewed, strictly positive, long tail. mean/median well above 1. Log it and it turns symmetric.',
    normal: 'Symmetric bell, mean = median, thin tails.',
    poisson: 'Whole numbers, variance close to the mean, no long tail.',
    negbinom: 'Whole numbers, variance FAR above the mean. A mixture of Poissons with different rates.',
    exponential: 'Highest at zero and falling steadily. Waiting time with a constant hazard.',
    binomial: 'Whole numbers, bounded above by n, roughly symmetric unless p is extreme.',
    mixture: 'Two humps. Not one distribution with outliers, two populations sharing an axis.',
    uniform: 'Flat. Every value equally likely. What p values look like under the null.',
    pareto: 'Extremely heavy tail. Straight line on log-log axes. The mean may barely converge.',
    geometric: 'Whole numbers starting at 1, falling geometrically. Attempts until first success.'
  };
  var current = null, answered = false;
  function newRound() {
    current = pool[Math.floor(Math.random() * pool.length)];
    answered = false;
    var D = DISTS[current], r = mul(Math.floor(Math.random() * 100000));
    var a = D.p1[4], b = D.p2 ? D.p2[4] : 0, data = [];
    for (var i = 0; i < 5000; i++) data.push(D.draw(r, a, b));
    var s = data.slice().sort(function (x, y) { return x - y; });
    var P = pal(), A = cv(c1, 180), p = { l: 30, r: 14, t: 12, b: 28 };
    frame(A.c, A.w, A.h, p, 'value', 'how often', P);
    hist(A.c, data, p, A.w, A.h, 50, P.a2, Math.min(0, qtl(s, 0.001)), qtl(s, 0.99) * 1.05 + 0.001);
    var mu = mean(data), md = qtl(s, 0.5), v = sd(data) * sd(data);
    out.innerHTML = '<b>Diagnostics:</b> mean ' + fmt(mu) + ' &nbsp; median ' + fmt(md) +
      ' &nbsp; mean/median ' + fmt(mu / (md || 1)) + ' &nbsp; variance/mean ' + fmt(v / (mu || 1)) +
      ' &nbsp; min ' + fmt(s[0]) + ' &nbsp; max ' + fmt(s[s.length - 1]) +
      ' &nbsp; whole numbers: ' + (data.every(function (x) { return Math.abs(x - Math.round(x)) < 1e-9; }) ? 'yes' : 'no');
    box.innerHTML = pool.map(function (k) {
      return '<button class="opt" data-g="' + k + '">' + DISTS[k].name + '</button>';
    }).join('');
    box.querySelectorAll('[data-g]').forEach(function (b2) {
      b2.addEventListener('click', function () {
        if (answered) return;
        answered = true;
        var g = b2.getAttribute('data-g'), P2 = pal();
        var right = g === current;
        box.querySelectorAll('[data-g]').forEach(function (x) {
          if (x.getAttribute('data-g') === current) { x.style.borderColor = P2.a3; x.style.color = P2.a3; }
          else if (x === b2) { x.style.borderColor = P2.warn; x.style.color = P2.warn; }
        });
        out.innerHTML += '<br><br><b style="color:' + (right ? P2.a3 : P2.warn) + '">' +
          (right ? 'Correct.' : 'It was ' + DISTS[current].name + '.') + '</b> ' + HINTS[current];
      });
    });
  }
  btn.addEventListener('click', newRound);
  root._draw = function () { if (current) { /* keep the round, just resize */ } };
  newRound();
}

/* ---------- boot ---------- */
var WIDGETS = [];
function initWidgets() {
  var map = { fdist: wDist, fclt: wClt, fci: wCi, foutlier: wOutlier, fidentify: wIdentify };
  Object.keys(map).forEach(function (id) {
    var el = document.getElementById('w-' + id);
    if (el) { try { map[id](el); WIDGETS.push(el); } catch (e) { console.error(id, e); } }
  });
}
function redrawAll() { WIDGETS.forEach(function (e) { if (e._draw) try { e._draw(); } catch (x) {} }); }
window.addEventListener('resize', function () { clearTimeout(window.__rt); window.__rt = setTimeout(redrawAll, 150); });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initWidgets); else initWidgets();

window.__legacyRedraw=(window.__legacyRedraw||[]).concat([redrawAll]);
