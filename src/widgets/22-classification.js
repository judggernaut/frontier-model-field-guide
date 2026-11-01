/* Chapter 22 widgets: email threshold + confusion matrix, accuracy-lies grid,
   model-quality humps, ROC step builder, ROC/PR with spam share. SVG + HTML use CSS tokens so both themes work. */
var SD = 0.11;
function sf(x, m) { return 1 - G.ncdf((x - m) / SD); }
function pdf(x, m) { return Math.exp(-((x - m) * (x - m)) / (2 * SD * SD)); }
var C = { tp: 'var(--tp)', fp: 'var(--fp)', fn: 'var(--fn)', tn: 'var(--tn)' };
var M = { l: 44, t: 10, w: 244, h: 230 };
function PX(v) { return M.l + v * M.w; }
function PY(v) { return M.t + (1 - v) * M.h; }
function axesSvg(xl, yl, ticks, fmt) {
  var r = '<rect x="' + M.l + '" y="' + M.t + '" width="' + M.w + '" height="' + M.h + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
  ticks.forEach(function (v) {
    r += '<text x="' + PX(v) + '" y="' + (M.t + M.h + 15) + '" text-anchor="middle" font-size="11" fill="var(--faint)">' + fmt(v) + '</text>' +
      '<text x="' + (M.l - 7) + '" y="' + (PY(v) + 4) + '" text-anchor="end" font-size="11" fill="var(--faint)">' + fmt(v) + '</text>';
  });
  r += '<text x="' + (M.l + M.w / 2) + '" y="281" text-anchor="middle" font-size="12" fill="var(--muted)">' + xl + '</text>' +
    '<text x="13" y="' + (M.t + M.h / 2) + '" text-anchor="middle" font-size="12" fill="var(--muted)" transform="rotate(-90 13 ' + (M.t + M.h / 2) + ')">' + yl + '</text>';
  return r;
}
function diag() { return '<line x1="' + PX(0) + '" y1="' + PY(0) + '" x2="' + PX(1) + '" y2="' + PY(1) + '" stroke="var(--faint)" stroke-dasharray="3 3" stroke-width="1"/>'; }
window.__clAxes = { axesSvg: axesSvg, diag: diag, PX: PX, PY: PY };

/* 1. Twenty-two emails, a threshold, the confusion matrix, four metrics, and the per-class table */
G.widget('w-cl-email', function (root) {
  var pos = [0.97, 0.91, 0.86, 0.81, 0.73, 0.66, 0.55, 0.44, 0.33, 0.24];
  var neg = [0.76, 0.61, 0.5, 0.41, 0.37, 0.29, 0.21, 0.16, 0.12, 0.09, 0.07, 0.04];
  var items = pos.map(function (s) { return { s: s, p: 1 }; }).concat(neg.map(function (s) { return { s: s, p: 0 }; })).sort(function (a, b) { return a.s - b.s; });
  var t = G.$(root, '#cl-t'), tout = G.$(root, '#cl-t-o'), row = G.$(root, '[data-row]');
  row.innerHTML = items.map(function (it, i) { return '<div class="cl-cell" title="Score ' + it.s.toFixed(2) + ', ' + (it.p ? 'really spam' : 'really legit') + '"><span class="cl-dot"></span><span class="cl-lab"></span></div>'; }).join('');
  var cells = G.$$(row, '.cl-cell');
  function bar(segs) { return '<div class="cl-bar">' + segs.filter(function (s) { return s[0] > 0; }).map(function (s) { return '<span style="flex:' + s[0] + ';background:' + s[1] + '"></span>'; }).join('') + '</div>'; }
  function mrow(n, q, fr, segs, v) { return '<div class="cl-mrow"><div><div class="cl-mname">' + n + '</div><div class="cl-mfrac">' + fr + '</div></div><div>' + bar(segs) + '<div class="cl-mq">' + q + '</div></div><div class="cl-mval">' + G.pct(v) + '</div></div>'; }
  function box(n, c, l) { return '<div class="cl-b" style="--c:' + c + '"><strong>' + n + '</strong><span>' + l + '</span></div>'; }
  function setPC(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function draw() {
    var th = t.value / 100; tout.textContent = th.toFixed(2);
    var k = { tp: 0, fp: 0, fn: 0, tn: 0 };
    items.forEach(function (it, i) {
      var pr = it.s >= th, o = pr ? (it.p ? 'tp' : 'fp') : (it.p ? 'fn' : 'tn'); k[o]++;
      cells[i].classList.toggle('pred', pr); cells[i].firstChild.style.background = C[o]; cells[i].lastChild.textContent = o.toUpperCase();
    });
    G.$(root, '[data-mx]').innerHTML = '<div></div><div class="cl-h">Flagged spam</div><div class="cl-h">Left in inbox</div><div class="cl-rh">Really spam</div>' +
      box(k.tp, C.tp, 'TP') + box(k.fn, C.fn, 'FN') + '<div class="cl-rh">Really legit</div>' + box(k.fp, C.fp, 'FP') + box(k.tn, C.tn, 'TN');
    var P = k.tp + k.fp ? k.tp / (k.tp + k.fp) : null, R = k.tp / (k.tp + k.fn), A = (k.tp + k.tn) / items.length;
    var F = (P && R) ? 2 * P * R / (P + R) : (P === null ? null : 0), f1 = Math.round((F || 0) * 100);
    G.$(root, '[data-metrics]').innerHTML =
      mrow('Precision', 'Of what I flagged, how much was really spam?', k.tp + ' / ' + (k.tp + k.fp), [[k.tp, C.tp], [k.fp, C.fp]], P) +
      mrow('Recall', 'Of all the real spam, how much did I catch?', k.tp + ' / ' + (k.tp + k.fn), [[k.tp, C.tp], [k.fn, C.fn]], R) +
      mrow('Accuracy', 'Of every email, how many did I get right?', (k.tp + k.tn) + ' / ' + items.length, [[k.tp, C.tp], [k.tn, C.tn], [k.fp, C.fp], [k.fn, C.fn]], A) +
      mrow('F1', 'High only if precision and recall are both high', '2PR / (P+R)', [[f1, 'var(--roc)'], [100 - f1, 'transparent']], F);
    var lp = k.tn + k.fn ? k.tn / (k.tn + k.fn) : null, lr = k.tn / (k.tn + k.fp), lf = (lp && lr) ? 2 * lp * lr / (lp + lr) : 0, sf1 = F || 0;
    setPC('cl-pc-sp', G.pct(P)); setPC('cl-pc-sr', G.pct(R)); setPC('cl-pc-sf', G.pct(F));
    setPC('cl-pc-lp', G.pct(lp)); setPC('cl-pc-lr', G.pct(lr)); setPC('cl-pc-lf', G.pct(lf));
    setPC('cl-pc-mac', G.pct((sf1 + lf) / 2)); setPC('cl-pc-wt', G.pct((10 * sf1 + 12 * lf) / 22)); setPC('cl-pc-mic', G.pct(A));
    setPC('cl-pc-note', 'At threshold ' + th.toFixed(2) + ': ' + k.tp + ' TP, ' + k.fp + ' FP, ' + k.fn + ' FN, ' + k.tn + ' TN. Move the threshold in the widget above and this table follows.');
  }
  G.on(t, 'input', draw);
  G.on(G.$(root, '[data-lo]'), 'click', function () { t.value = 20; draw(); });
  G.on(G.$(root, '[data-hi]'), 'click', function () { t.value = 80; draw(); });
  return draw;
});

/* 2. Accuracy lies: 100 squares, one of them spam */
G.widget('cl-grid100', function (root) {
  var g = G.$(root, '[data-grid]'), h = '';
  for (var i = 0; i < 100; i++) h += '<i' + (i === 37 ? ' class="s"' : '') + '></i>';
  g.innerHTML = h;
});

/* 3. Two humps: threshold picks a spot, model quality sets the ceiling */
G.widget('w-cl-humps', function (root) {
  var st = G.$(root, '#cl-ht'), sq = G.$(root, '#cl-hq'), svg = G.$(root, 'svg'), W = 640, PB = 190, N = 160;
  function stats(t, ml, ms) { var tp = sf(t, ms), fp = sf(t, ml), P = tp + fp > 1e-9 ? tp / (tp + fp) : 0, R = tp; return { P: P, R: R, F: P + R > 0 ? 2 * P * R / (P + R) : 0 }; }
  function X(v) { return v * W; } function Y(v) { return PB - v * 150; }
  function area(m, a, b, c) { var d = 'M' + X(a) + ',' + PB; for (var i = 0; i <= N; i++) { var x = a + (b - a) * i / N; d += ' L' + X(x).toFixed(1) + ',' + Y(pdf(x, m)).toFixed(1); } return '<path d="' + d + ' L' + X(b) + ',' + PB + ' Z" fill="' + c + '" fill-opacity="0.55"/>'; }
  function ln(m, c) { var d = ''; for (var i = 0; i <= N; i++) { var x = i / N; d += (i ? ' L' : 'M') + X(x).toFixed(1) + ',' + Y(pdf(x, m)).toFixed(1); } return '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="1.5"/>'; }
  function draw() {
    var t = st.value / 100, d = sq.value / 100, ml = 0.5 - d / 2, ms = 0.5 + d / 2;
    G.$(root, '#cl-ht-o').textContent = t.toFixed(2);
    G.$(root, '#cl-hq-o').textContent = d < 0.25 ? 'Weak' : d < 0.45 ? 'Decent' : 'Strong';
    var s = area(ml, 0, t, C.tn) + area(ml, t, 1, C.fp) + area(ms, 0, t, C.fn) + area(ms, t, 1, C.tp) + ln(ml, 'var(--tn)') + ln(ms, 'var(--tp)');
    s += '<line x1="0" y1="' + PB + '" x2="' + W + '" y2="' + PB + '" stroke="var(--line)"/><line x1="' + X(t) + '" y1="10" x2="' + X(t) + '" y2="' + PB + '" stroke="var(--fg)" stroke-width="1.5" stroke-dasharray="4 3"/>';
    s += '<text x="' + X(ml) + '" y="' + (Y(1) - 7) + '" text-anchor="middle" font-size="12" fill="var(--muted)">Real legit</text><text x="' + X(ms) + '" y="' + (Y(1) - 7) + '" text-anchor="middle" font-size="12" fill="var(--muted)">Real spam</text>';
    s += '<text x="' + Math.max(40, X(t) - 8) + '" y="210" text-anchor="end" font-size="11" fill="var(--faint)">Inbox</text><text x="' + Math.min(X(t) + 8, 560) + '" y="210" font-size="11" fill="var(--faint)">Spam folder</text>';
    svg.innerHTML = s;
    var c = stats(t, ml, ms);
    G.$(root, '[data-p]').textContent = G.pct(c.P); G.$(root, '[data-r]').textContent = G.pct(c.R); G.$(root, '[data-f]').textContent = G.pct(c.F);
    var best = { F: 0, t: 0 }; for (var i = 5; i <= 95; i++) { var z = stats(i / 100, ml, ms); if (z.F > best.F) best = { F: z.F, t: i / 100 }; }
    G.$(root, '[data-bf]').textContent = G.pct(best.F); G.$(root, '[data-bt]').textContent = 'at threshold ' + best.t.toFixed(2);
  }
  G.on([st, sq], 'input', draw);
  return draw;
});

/* 4. Build an ROC curve from ten emails, one threshold at a time */
G.widget('w-cl-rocsteps', function (root) {
  var spam = [0.9, 0.8, 0.7, 0.55, 0.35], legit = [0.6, 0.45, 0.3, 0.2, 0.1];
  var steps = [
    { t: 1.0, c: 'Threshold 1.0: nothing is spammy enough, so nothing is flagged.' },
    { t: 0.75, c: 'Threshold 0.75: only the very spammy emails are flagged.' },
    { t: 0.5, c: 'Threshold 0.5: more spam caught, and one good email caught too.' },
    { t: 0.25, c: 'Threshold 0.25: all spam caught, but 3 good emails flagged.' },
    { t: 0.0, c: 'Threshold 0: everything flagged, all spam and all good emails.' },
    { t: null, c: 'Connect the dots. That line is the ROC curve. The shaded area is the AUC.' }];
  var k = 0, lineSvg = G.$(root, '[data-line]'), roc = G.$(root, '[data-roc]');
  function X(s) { return 70 + s * 540; }
  function pt(t) { return { x: legit.filter(function (s) { return s >= t; }).length / 5, y: spam.filter(function (s) { return s >= t; }).length / 5 }; }
  function draw() {
    var st = steps[k], show = st.t !== null, t = show ? st.t : 0.5;
    G.$(root, '[data-cap]').textContent = st.c; G.$(root, '[data-n]').textContent = 'Step ' + (k + 1) + ' of ' + steps.length;
    var s = '';
    if (show && t < 1) s += '<rect x="' + X(t) + '" y="8" width="' + (610 - X(t)) + '" height="92" fill="var(--accent-soft)" rx="5"/>';
    s += '<text x="10" y="39" font-size="12" fill="var(--muted)">Spam</text><text x="10" y="79" font-size="12" fill="var(--muted)">Good</text><line x1="70" y1="100" x2="610" y2="100" stroke="var(--line)"/>';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) { s += '<text x="' + X(v) + '" y="116" text-anchor="middle" font-size="11" fill="var(--faint)">' + v + '</text>'; });
    spam.forEach(function (v) { s += '<circle cx="' + X(v) + '" cy="35" r="10" fill="' + (show ? (v >= t ? C.tp : C.fn) : C.tp) + '"/>'; });
    legit.forEach(function (v) { s += '<circle cx="' + X(v) + '" cy="75" r="10" fill="' + (show ? (v >= t ? C.fp : C.tn) : C.tn) + '"/>'; });
    if (show) s += '<line x1="' + X(t) + '" y1="4" x2="' + X(t) + '" y2="102" stroke="var(--fg)" stroke-width="1.5" stroke-dasharray="4 3"/>';
    lineSvg.innerHTML = s;
    G.$(root, '[data-up]').textContent = show ? spam.filter(function (v) { return v >= t; }).length + ' of 5' : '—';
    G.$(root, '[data-rt]').textContent = show ? legit.filter(function (v) { return v >= t; }).length + ' of 5' : '—';
    G.$(root, '[data-area]').style.visibility = show ? 'hidden' : 'visible';
    var r = axesSvg('Good emails wrongly flagged', 'Spam caught', [0, 0.2, 0.4, 0.6, 0.8, 1], function (v) { return Math.round(v * 5); });
    r += '<text x="' + PX(0.04) + '" y="' + (PY(1) + 18) + '" font-size="11" fill="var(--faint)">Perfect corner</text>';
    if (!show) {
      var all = steps.slice(0, 5).map(function (q) { return pt(q.t); });
      var d = all.map(function (p, i) { return (i ? 'L' : 'M') + PX(p.x) + ',' + PY(p.y); }).join(' ');
      r += '<path d="' + d + ' L' + PX(1) + ',' + PY(0) + ' Z" fill="var(--roc)" fill-opacity="0.2"/><path d="' + d + '" fill="none" stroke="var(--roc)" stroke-width="2"/>' + diag();
    }
    steps.slice(0, Math.min(k + 1, 5)).forEach(function (q, i) {
      var p = pt(q.t), cur = show && i === k;
      r += '<circle cx="' + PX(p.x) + '" cy="' + PY(p.y) + '" r="' + (cur ? 7 : 5) + '" fill="' + (cur ? 'var(--fg)' : 'var(--roc)') + '" stroke="var(--surface)" stroke-width="2"/><text x="' + (PX(p.x) + 9) + '" y="' + (PY(p.y) + 15) + '" font-size="11" fill="var(--faint)">t=' + q.t.toFixed(2) + '</text>';
    });
    roc.innerHTML = r;
  }
  G.on(G.$(root, '[data-next]'), 'click', function () { k = Math.min(k + 1, steps.length - 1); draw(); });
  G.on(G.$(root, '[data-prev]'), 'click', function () { k = Math.max(k - 1, 0); draw(); });
  return draw;
});

/* 5. ROC and PR together, with spam share, plus the random-pair check */
G.widget('w-cl-auc', function (root) {
  var N = 160, ml = 0.39, ms = 0.61, st = G.$(root, '#cl-at'), sq = G.$(root, '#cl-aq'), spi = G.$(root, '#cl-api');
  function pt(t, pi) { var tpr = sf(t, ms), fpr = sf(t, ml), den = pi * tpr + (1 - pi) * fpr; return { tpr: tpr, fpr: fpr, p: den > 1e-9 ? pi * tpr / den : 1 }; }
  function draw() {
    var t = st.value / 100, d = sq.value / 100, pi = spi.value / 100; ml = 0.5 - d / 2; ms = 0.5 + d / 2;
    G.$(root, '#cl-at-o').textContent = t.toFixed(2);
    G.$(root, '#cl-aq-o').textContent = d < 0.15 ? 'Random' : d < 0.3 ? 'Weak' : d < 0.45 ? 'Decent' : 'Strong';
    G.$(root, '#cl-api-o').textContent = Math.round(pi * 100) + '%';
    var X = function (v) { return v * 640; }, PB = 145, mx = Math.max(pi, 1 - pi), hs = pi / mx, hl = (1 - pi) / mx, Y = function (v) { return PB - v * 120; };
    function area(m, a, b, h, c) { var p = 'M' + X(a) + ',' + PB; for (var i = 0; i <= N; i++) { var x = a + (b - a) * i / N; p += ' L' + X(x).toFixed(1) + ',' + Y(h * pdf(x, m)).toFixed(1); } return '<path d="' + p + ' L' + X(b) + ',' + PB + ' Z" fill="' + c + '" fill-opacity="0.55"/>'; }
    var s = area(ml, 0, t, hl, C.tn) + area(ml, t, 1, hl, C.fp) + area(ms, 0, t, hs, C.fn) + area(ms, t, 1, hs, C.tp);
    s += '<line x1="0" y1="' + PB + '" x2="640" y2="' + PB + '" stroke="var(--line)"/><line x1="' + X(t) + '" y1="8" x2="' + X(t) + '" y2="' + PB + '" stroke="var(--fg)" stroke-width="1.5" stroke-dasharray="4 3"/>';
    s += '<text x="' + X(ml) + '" y="' + (Y(hl) - 6) + '" text-anchor="middle" font-size="12" fill="var(--muted)">Real legit</text><text x="' + X(ms) + '" y="' + (Y(hs) - 6) + '" text-anchor="middle" font-size="12" fill="var(--muted)">Real spam</text>';
    s += '<text x="' + Math.max(40, X(t) - 8) + '" y="163" text-anchor="end" font-size="11" fill="var(--faint)">Inbox</text><text x="' + Math.min(X(t) + 8, 560) + '" y="163" font-size="11" fill="var(--faint)">Spam folder</text>';
    G.$(root, '[data-dist]').innerHTML = s;
    var pts = []; for (var i = 0; i <= 300; i++) pts.push(pt(1.6 - i * 2.2 / 300, pi));
    var roc = 0, pra = 0; for (i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i]; roc += (b.fpr - a.fpr) * (a.tpr + b.tpr) / 2; pra += (b.tpr - a.tpr) * (a.p + b.p) / 2; }
    var c = pt(t, pi), id = function (v) { return v; };
    var rl = pts.map(function (q, i) { return (i ? 'L' : 'M') + PX(q.fpr).toFixed(1) + ',' + PY(q.tpr).toFixed(1); }).join(' ');
    var r = axesSvg('False alarm rate', 'Recall', [0, 0.5, 1], id) + '<path d="' + rl + ' L' + PX(1) + ',' + PY(0) + ' L' + PX(0) + ',' + PY(0) + ' Z" fill="var(--roc)" fill-opacity="0.2"/>' + diag() + '<path d="' + rl + '" fill="none" stroke="var(--roc)" stroke-width="2"/>';
    r += '<text x="' + PX(0.6) + '" y="' + (PY(0.6) + 16) + '" font-size="11" fill="var(--faint)" transform="rotate(-43 ' + PX(0.6) + ' ' + (PY(0.6) + 16) + ')">random guessing</text><circle cx="' + PX(c.fpr) + '" cy="' + PY(c.tpr) + '" r="6" fill="var(--fg)" stroke="var(--surface)" stroke-width="2"/>';
    G.$(root, '[data-roc]').innerHTML = r;
    var pp = pts.filter(function (q) { return q.tpr > 0.002; });
    var pl = pp.map(function (q, i) { return (i ? 'L' : 'M') + PX(q.tpr).toFixed(1) + ',' + PY(q.p).toFixed(1); }).join(' ');
    var p = axesSvg('Recall', 'Precision', [0, 0.5, 1], id) + '<path d="' + pl + ' L' + PX(1) + ',' + PY(0) + ' L' + PX(0) + ',' + PY(0) + ' Z" fill="var(--pr)" fill-opacity="0.2"/><line x1="' + PX(0) + '" y1="' + PY(pi) + '" x2="' + PX(1) + '" y2="' + PY(pi) + '" stroke="var(--faint)" stroke-dasharray="3 3"/><path d="' + pl + '" fill="none" stroke="var(--pr)" stroke-width="2"/>';
    p += '<text x="' + PX(0.97) + '" y="' + (PY(pi) - 6) + '" text-anchor="end" font-size="11" fill="var(--faint)">random guessing</text><circle cx="' + PX(c.tpr) + '" cy="' + PY(c.p) + '" r="6" fill="var(--fg)" stroke="var(--surface)" stroke-width="2"/>';
    G.$(root, '[data-pr]').innerHTML = p;
    G.$(root, '[data-p]').textContent = G.pct(c.p); G.$(root, '[data-r]').textContent = G.pct(c.tpr); G.$(root, '[data-f]').textContent = G.pct(c.fpr);
    G.$(root, '[data-ra]').textContent = G.fmt(roc, 2); G.$(root, '[data-pa]').textContent = G.fmt(pra, 2);
    G.$(root, '[data-pairs]').textContent = 'See how often spam scores higher.';
  }
  var rnd = G.rng(7);
  G.on(G.$(root, '[data-draw]'), 'click', function () {
    var w = 0; for (var i = 0; i < 1000; i++) if (ms + SD * G.gauss(rnd) > ml + SD * G.gauss(rnd)) w++;
    G.$(root, '[data-pairs]').textContent = 'Spam scored higher in ' + G.fmt(w / 10, 1) + '% of pairs. ROC-AUC is ' + G.$(root, '[data-ra]').textContent + '.';
  });
  G.on([st, sq, spi], 'input', draw);
  return draw;
});
