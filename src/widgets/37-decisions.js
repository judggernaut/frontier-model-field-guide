/* Chapter 37: thresholds from costs need calibrated probabilities; a binary judge is one fixed point. */
G.widget('w-dm-thr', function (root) {
  var sR = G.$(root, '#dm-r'), sT = G.$(root, '#dm-t'), oR = G.$(root, '#dm-r-o'), oT = G.$(root, '#dm-t-o');
  var cvC = G.$(root, '[data-cv=cost]'), cvR = G.$(root, '[data-cv=rel]'), out = G.$(root, '[data-out]');
  var btns = G.$$(root, '[data-m]'), snap = G.$(root, '[data-snap]'), mode = 'cal';
  function k(n) { return G.$(root, '[data-k=' + n + ']'); }
  function logit(p) { return Math.log(p / (1 - p)); }

  // Synthetic labelled sample: true risk q, label drawn from q. Both models rank identically.
  var N = 400, r = G.rng(37), Y = [], PC = [], PO = [], J = [];
  for (var i = 0; i < N; i++) {
    var q = G.sigmoid(1.4 * G.gauss(r) - 0.7);
    Y.push(r() < q ? 1 : 0);
    PC.push(q);                                      // calibrated: says what it means
    PO.push(G.sigmoid(2.4 * logit(q)));              // overconfident: same order, pushed toward 0 and 1
    J.push(logit(q) + 0.9 * G.gauss(r) > 0 ? 1 : 0); // binary judge: one noisy yes or no
  }
  function confusion(pred) {
    var tp = 0, fp = 0, fn = 0;
    for (var i = 0; i < N; i++) { if (pred(i)) { if (Y[i]) tp++; else fp++; } else if (Y[i]) fn++; }
    return { tp: tp, fp: fp, fn: fn };
  }
  function costOf(c, ratio) { return (c.fp + ratio * c.fn) / N; }
  function at(P, t) { return confusion(function (i) { return P[i] >= t; }); }
  var judge = confusion(function (i) { return J[i] === 1; });
  function bins(P) {
    var B = [];
    for (var b = 0; b < 10; b++) B.push({ n: 0, p: 0, y: 0 });
    for (var i = 0; i < N; i++) { var b2 = Math.min(9, Math.floor(P[i] * 10)); B[b2].n++; B[b2].p += P[i]; B[b2].y += Y[i]; }
    var ece = 0;
    B.forEach(function (o) { if (o.n) { o.p /= o.n; o.y /= o.n; ece += o.n / N * Math.abs(o.y - o.p); } });
    return { B: B, ece: ece };
  }
  var BC = bins(PC), BO = bins(PO);
  var jy1 = judge.tp / Math.max(1, judge.tp + judge.fp), jn = N - judge.tp - judge.fp, jy0 = judge.fn / Math.max(1, jn);

  function draw() {
    var P = G.pal(), ratio = +sR.value, t = +sT.value, tStar = 1 / (1 + ratio);
    oR.textContent = ratio; oT.textContent = G.fmt(t, 2);
    var SEL = mode === 'cal' ? PC : PO, selCol = mode === 'cal' ? P.eli5 : P.lead, selB = mode === 'cal' ? BC : BO;
    var curves = { cal: [], over: [] }, best = { t: 0.5, c: 1e9 }, ymax = costOf(judge, ratio);
    var grid = [0.005, 0.01, 0.015];
    for (var g = 2; g <= 98; g++) grid.push(g / 100);
    grid.push(0.99, 0.995);
    grid.forEach(function (x) {
      var cc = costOf(at(PC, x), ratio), co = costOf(at(PO, x), ratio);
      curves.cal.push([x, cc]); curves.over.push([x, co]);
      var cs = mode === 'cal' ? cc : co;
      if (cs < best.c) best = { t: x, c: cs };
      ymax = Math.max(ymax, Math.min(cc, co));
    });
    ymax = Math.min(Math.max(ymax * 1.35, 0.2), ratio * 0.4);
    var yt = [0, ymax / 2, ymax];

    // left: expected cost against threshold
    var c = G.canvas(cvC, 250), ctx = c.ctx, pad = { l: 44, r: 12, t: 26, b: 36 };
    var ax = G.axes(ctx, c.w, c.h, pad, { x: [0, 1], y: [0, ymax], xt: [0, 0.25, 0.5, 0.75, 1], yt: yt, yf: function (v) { return G.fmt(v, 2); }, xl: 'threshold' });
    function clip(pts) { return pts.map(function (p) { return [ax.X(p[0]), ax.Y(Math.min(p[1], ymax))]; }); }
    G.line(ctx, [[ax.X(0), ax.Y(costOf(judge, ratio))], [ax.X(1), ax.Y(costOf(judge, ratio))]], P.muted, 1.5, [6, 4]);
    G.line(ctx, clip(curves.cal), P.eli5, mode === 'cal' ? 2.6 : 1.4);
    G.line(ctx, clip(curves.over), P.lead, mode === 'over' ? 2.6 : 1.4);
    G.line(ctx, [[ax.X(tStar), pad.t], [ax.X(tStar), c.h - pad.b]], P.faint, 1.2, [2, 3]);
    G.line(ctx, [[ax.X(t), pad.t], [ax.X(t), c.h - pad.b]], P.fg, 1.5);
    var cNow = costOf(at(SEL, t), ratio);
    G.dot(ctx, ax.X(t), ax.Y(Math.min(cNow, ymax)), 5.5, selCol, P.surface);
    G.dot(ctx, ax.X(best.t), ax.Y(best.c), 4, P.good, P.surface);
    G.text(ctx, 'expected cost per case', pad.l, 10, P.muted, 'left', 12);
    G.text(ctx, '1/(1+ratio)', Math.min(ax.X(tStar) + 4, c.w - 80), pad.t + 10, P.faint, 'left', 11.5);

    // right: reliability diagram for the selected model, plus the judge's two points
    var c2 = G.canvas(cvR, 250), x2 = c2.ctx, pd = { l: 44, r: 16, t: 26, b: 36 };
    var ay = G.axes(x2, c2.w, c2.h, pd, { x: [0, 1], y: [0, 1], xt: [0, 0.5, 1], yt: [0, 0.5, 1], xf: function (v) { return G.pct(v); }, yf: function (v) { return G.pct(v); }, xl: 'stated probability' });
    G.line(x2, [[ay.X(0), ay.Y(0)], [ay.X(1), ay.Y(1)]], P.faint, 1, [3, 3]);
    var pts = [];
    selB.B.forEach(function (o) {
      if (!o.n) return;
      G.line(x2, [[ay.X(o.p), ay.Y(o.p)], [ay.X(o.p), ay.Y(o.y)]], P.warn, 1.2);
      pts.push([ay.X(o.p), ay.Y(o.y)]);
    });
    G.line(x2, pts, selCol, 2);
    selB.B.forEach(function (o) { if (o.n) G.dot(x2, ay.X(o.p), ay.Y(o.y), 2.5 + Math.sqrt(o.n) / 2.2, selCol, P.surface); });
    x2.fillStyle = P.muted; x2.fillRect(ay.X(1) - 5, ay.Y(jy1) - 5, 10, 10); x2.fillRect(ay.X(0) - 5, ay.Y(jy0) - 5, 10, 10);
    G.text(x2, 'judge yes', ay.X(1) - 10, ay.Y(jy1), P.muted, 'right', 11.5);
    G.text(x2, 'judge no', ay.X(0) + 8, ay.Y(jy0) - 14, P.muted, 'left', 11.5);
    G.text(x2, '↑ observed positive rate · ECE ' + G.fmt(selB.ece, 3), pd.l + 4, 10, P.muted, 'left', 12);

    var cf = at(SEL, t), prec = cf.tp / Math.max(1, cf.tp + cf.fp), rec = cf.tp / Math.max(1, cf.tp + cf.fn);
    k('prec').textContent = G.pct(prec); k('rec').textContent = G.pct(rec); k('cost').textContent = G.fmt(cNow, 3); k('ece').textContent = G.fmt(selB.ece, 3);
    var cStar = costOf(at(SEL, tStar), ratio), jc = costOf(judge, ratio), name = mode === 'cal' ? 'calibrated' : 'overconfident';
    var gap = cStar - best.c;
    out.innerHTML = 'A miss costs ' + ratio + '× a false alarm, so the rule for calibrated probabilities is act above <b>' + G.fmt(tStar, 2) + '</b>. ' +
      'For the ' + name + ' model that rule costs ' + G.fmt(cStar, 3) + ' per case; the best threshold on these labels is ' + G.fmt(best.t, 2) + ' at ' + G.fmt(best.c, 3) + '. ' +
      (gap < 0.01 ? 'They nearly coincide: when the probabilities are honest, the formula is enough. ' :
        'The formula overshoots by ' + G.fmt(gap, 3) + ' per case because the stated probabilities are too extreme. Pick the threshold on labelled data or recalibrate first. ') +
      'Your threshold of ' + G.fmt(t, 2) + ' gives precision ' + G.pct(prec) + ' and recall ' + G.pct(rec) + '. ' +
      'The binary judge has one operating point (precision ' + G.pct(judge.tp / Math.max(1, judge.tp + judge.fp)) + ', recall ' + G.pct(judge.tp / Math.max(1, judge.tp + judge.fn)) + ', cost ' + G.fmt(jc, 3) + ') and no dial to turn when costs change.';
  }
  btns.forEach(function (b) {
    G.on(b, 'click', function () { mode = b.dataset.m; btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); draw(); });
  });
  G.on(snap, 'click', function () { sT.value = (1 / (1 + +sR.value)).toFixed(2); sT.dispatchEvent(new Event('input', { bubbles: true })); });
  G.on([sR, sT], 'input', draw);
  return draw;
});
