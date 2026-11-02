/* Chapter 38: framing simulator. Format, order swap, evidence-first, rubric decomposition and "unsure" on one labelled set.
   Effect sizes are illustrative; directions follow the cited literature. */
G.widget('w-ak-frame', function (root) {
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]'), fb = G.$$(root, '[data-f]'), opt = {};
  G.$$(root, '[data-o]').forEach(function (c) { opt[c.dataset.o] = c; });
  function k(n) { return G.$(root, '[data-k=' + n + ']'); }
  var FMT = {   // L: leniency from wording, o: order/position effect, k: noise multiplier
    yn: { name: 'Yes / no', L: 0.30, o: 0.12, k: 1.0 },
    lk: { name: '1–5 scale', L: 0.25, o: 0.15, k: 1.2 },   // score compression: coarser, noisier
    pw: { name: 'Pairwise', L: 0.0, o: 0.55, k: 0.85 },    // easier comparison, strong position bias
    pr: { name: 'Probability', L: 0.10, o: 0.08, k: 1.0 }
  };
  var ORDER = ['yn', 'lk', 'pw', 'pr'], sel = 'yn';
  var N = 600, r = G.rng(38), D = [], H1 = [], H2 = [], N1 = [], N2 = [], A = [];
  for (var i = 0; i < N; i++) {
    var d = G.gauss(r); D.push(d);
    H1.push(d + 0.45 * G.gauss(r) > 0 ? 1 : 0); H2.push(d + 0.45 * G.gauss(r) > 0 ? 1 : 0);
    var n1 = G.gauss(r); N1.push(n1); N2.push(0.75 * n1 + 0.661 * G.gauss(r)); A.push(r() < 0.5 ? 1 : -1); // second run's noise correlates with the first
  }
  var ceiling = 0; for (i = 0; i < N; i++) ceiling += H1[i] === H2[i] ? 1 : 0; ceiling /= N;
  function auc(m) {
    var idx = m.map(function (v, j) { return j; }).sort(function (a, b) { return m[a] - m[b]; });
    var rank = 0, sumPos = 0, nP = 0;
    idx.forEach(function (j) { rank++; if (H1[j]) { sumPos += rank; nP++; } });
    var nN = N - nP; return (sumPos - nP * (nP + 1) / 2) / (nP * nN);
  }
  function sim(f, o) {
    var p = FMT[f], sig = 1.15 * p.k, L = p.L, ob = p.o;
    if (o.reason) { sig *= 0.85; L *= 0.7; }
    if (o.rubric) { sig *= 0.8; ob *= 0.6; L *= 0.5; }
    var U = o.unsure ? 0.35 : 0, agree = 0, cov = 0, flips = 0, m = [];
    for (var i = 0; i < N; i++) {
      var base = D[i] + sig * N1[i] + L;
      var mi = o.swap ? D[i] + L + sig * (N1[i] + N2[i]) / 2 : base + ob * A[i];
      if ((base + ob > 0) !== (base - ob > 0)) flips++;
      m.push(mi);
      if (Math.abs(mi) < U) continue;
      cov++; if ((mi > 0 ? 1 : 0) === H1[i]) agree++;
    }
    var cost = (o.swap ? 2 : 1) * (o.reason ? 4 : 1) * (o.rubric ? 1.8 : 1);
    return { agree: agree / Math.max(1, cov), cov: cov / N, rawFlip: flips / N, flip: o.swap ? 0 : flips / N, auc: f === 'pr' ? auc(m) : null, cost: cost };
  }
  function draw() {
    var P = G.pal(), o = {};
    Object.keys(opt).forEach(function (key) { o[key] = opt[key].checked; });
    var res = {}; ORDER.forEach(function (f) { res[f] = sim(f, o); });
    var base = sim(sel, {}), R = res[sel];
    var c = G.canvas(cv, 300), ctx = c.ctx, pl = 44, pr = 12, gw = (c.w - pl - pr) / 4;
    // top panel: agreement, zoomed to 50-100% so differences are visible
    var top = { l: pl, r: pr, t: 30, b: 300 - 180 }, ay = G.axes(ctx, c.w, 180, { l: pl, r: pr, t: 30, b: 6 }, { x: [0, 4], y: [0.5, 1], yt: [0.5, 0.75, 1], yf: function (v) { return G.pct(v); } });
    G.line(ctx, [[pl, ay.Y(ceiling)], [c.w - pr, ay.Y(ceiling)]], P.good, 1.5, [6, 4]);
    G.text(ctx, 'human–human ' + G.pct(ceiling), c.w - pr - 4, ay.Y(ceiling) - 9, P.good, 'right', 11.5);
    G.text(ctx, 'agreement with humans (axis starts at 50%)', pl, 12, P.accent, 'left', 12);
    // bottom panel: flip rate 0-50%
    ctx.save(); ctx.translate(0, 196);
    var by = G.axes(ctx, c.w, 104, { l: pl, r: pr, t: 20, b: 22 }, { x: [0, 4], y: [0, 0.5], yt: [0, 0.25, 0.5], yf: function (v) { return G.pct(v); } });
    ctx.restore();
    function BY(v) { return 196 + by.Y(v); }
    G.text(ctx, 'verdicts that flip when the order is reversed', pl, 196 + 8, P.warn, 'left', 12);
    ORDER.forEach(function (f, j) {
      var x0 = pl + j * gw, bw = Math.min(56, gw * 0.5), xb = x0 + gw / 2 - bw / 2, on = f === sel;
      ctx.globalAlpha = on ? 1 : 0.35;
      ctx.fillStyle = P.accent; ctx.fillRect(xb, ay.Y(res[f].agree), bw, ay.Y(0.5) - ay.Y(res[f].agree));
      ctx.fillStyle = P.warn; ctx.fillRect(xb, BY(Math.min(res[f].flip, 0.5)), bw, BY(0) - BY(Math.min(res[f].flip, 0.5)));
      ctx.globalAlpha = 1;
      var lx = xb + bw + 4;
      G.text(ctx, G.pct(res[f].agree), lx, ay.Y(res[f].agree) + 8, on ? P.fg : P.muted, 'left', 11.5);
      G.text(ctx, G.pct(res[f].flip), lx, Math.min(BY(Math.min(res[f].flip, 0.5)) + 8, BY(0) - 6), on ? P.fg : P.muted, 'left', 11.5);
      G.text(ctx, FMT[f].name, x0 + gw / 2, c.h - 8, on ? P.fg : P.muted, 'center', 12);
    });

    k('agr').textContent = G.pct(R.agree); k('flip').textContent = G.pct(R.flip); k('cov').textContent = G.pct(R.cov);
    k('auc').textContent = G.fmt(R.cost, 1) + '×';
    var d = R.agree - base.agree, parts = [];
    if (o.swap) parts.push('swapping cancels the order effect: before averaging, ' + G.pct(R.rawFlip) + ' of verdicts flipped with order' + (sel === 'pw' ? ', the classic position bias of pairwise judges' : ''));
    if (o.reason) parts.push('evidence-first trims noise and leniency');
    if (o.rubric) parts.push('separate checks cut noise, leniency and order sensitivity');
    if (o.unsure) parts.push('"unsure" sets aside the ' + G.pct(1 - R.cov) + ' of items nearest the boundary, so agreement is computed on fewer items');
    out.innerHTML = '<b>' + FMT[sel].name + '</b>: agreement with humans ' + G.pct(R.agree) + ' against a human ceiling of ' + G.pct(ceiling) +
      (parts.length ? ' (' + (d >= 0 ? '+' : '') + G.fmt(d * 100, 1) + ' points from the bare prompt). ' + parts.join('; ').replace(/^./, function (ch) { return ch.toUpperCase(); }) + '.' + (o.unsure && R.agree > ceiling ? ' Agreement on the easier covered items can exceed the all-items human ceiling.' : '') : '. Order flips ' + G.pct(R.flip) + ' of verdicts. Toggle the fixes to see what each buys.') +
      (sel === 'pr' ? ' Because this format yields a score, you also get an AUC of ' + G.fmt(R.auc, 2) + ' and can move the threshold.' : ' This format gives one operating point; read logprobs or switch to probabilities to get a curve.') +
      ' Cost: ' + G.fmt(R.cost, 1) + '× a single bare call, from extra calls and extra tokens.';
  }
  fb.forEach(function (b) {
    G.on(b, 'click', function () { sel = b.dataset.f; fb.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); draw(); });
  });
  G.on(G.$$(root, '[data-o]'), 'change', draw);
  return draw;
});
