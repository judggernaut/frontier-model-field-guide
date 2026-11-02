/* Chapter 39: DPO loss/gradient weight and a likelihood-displacement toy simulation */
G.widget('w-dp-loss', function (root) {
  var sb = G.$(root, '#dp-loss-b'), cv = G.$(root, 'canvas');
  var FAINT = [0.05, 0.1, 0.3, 1];
  function draw() {
    var P = G.pal(), beta = parseFloat(sb.value);
    G.$(root, '#dp-loss-b-o').textContent = G.fmt(beta, 2);
    var narrow = (cv.parentElement.clientWidth || 640) < 560, H = narrow ? 470 : 240;
    var c = G.canvas(cv, H), ctx = c.ctx;
    var pA = narrow ? { l: 46, r: 14, t: 22, b: 36 + 235 } : { l: 46, r: 14 + c.w / 2, t: 22, b: 36 };
    var pB = narrow ? { l: 46, r: 14, t: 22 + 235, b: 36 } : { l: 46 + c.w / 2, r: 14, t: 22, b: 36 };
    var lo = -20, hi = 20;
    var s = G.axes(ctx, c.w, H, pA, { x: [lo, hi], y: [0, 3], xt: [-20, -10, 0, 10, 20], yt: [0, 1, 2, 3], xl: 'log-ratio margin h (nats)' });
    var s2 = G.axes(ctx, c.w, H, pB, { x: [lo, hi], y: [0, 1], xt: [-20, -10, 0, 10, 20], yt: [0, 0.5, 1], xl: 'log-ratio margin h (nats)' });
    ctx.save(); ctx.beginPath(); ctx.rect(pA.l, pA.t, c.w - pA.l - pA.r, H - pA.t - pA.b); ctx.clip();
    FAINT.forEach(function (b) { var pts = []; for (var h = lo; h <= hi; h += 0.2) pts.push([s.X(h), s.Y(-Math.log(G.sigmoid(b * h)))]); G.line(ctx, pts, P.line, 1.2); });
    var pts = []; for (var h = lo; h <= hi; h += 0.1) pts.push([s.X(h), s.Y(-Math.log(G.sigmoid(beta * h)))]);
    G.line(ctx, pts, P.accent, 2.8);
    var tgt = 1 / (2 * beta);
    if (tgt <= hi) G.line(ctx, [[s.X(tgt), pA.t], [s.X(tgt), H - pA.b]], P.fn, 1.4, [4, 3]);
    ctx.restore();
    if (tgt <= hi) G.text(ctx, 'IPO target', s.X(tgt) + 4, pA.t + 8, P.fn, 'left', 11);
    G.text(ctx, 'loss = −log σ(βh)', pA.l + 4, pA.t - 10, P.muted);
    FAINT.forEach(function (b) { var pts = []; for (var h = lo; h <= hi; h += 0.2) pts.push([s2.X(h), s2.Y(G.sigmoid(-b * h))]); G.line(ctx, pts, P.line, 1.2); });
    var g = []; for (h = lo; h <= hi; h += 0.1) g.push([s2.X(h), s2.Y(G.sigmoid(-beta * h))]);
    G.line(ctx, g, P.tp, 2.8);
    G.text(ctx, 'per-pair weight σ(−βh)  (× β overall)', pB.l + 4, pB.t - 10, P.muted);
    G.$(root, '[data-out]').textContent = 'At β = ' + G.fmt(beta, 2) + ', a pair the model already separates by 10 nats still contributes ' + G.pct(G.sigmoid(-beta * 10)) +
      ' of full weight, and the loss only reaches zero as the margin goes to infinity. That is why DPO keeps pushing on pairs it has already learned. IPO replaces this with a squared loss around a finite target margin 1/(2τ), shown dashed with τ = β (' + G.fmt(1 / (2 * beta), 1) + ' nats).';
  }
  G.on(sb, 'input', draw);
  return draw;
});

G.widget('w-dp-track', function (root) {
  var sa = G.$(root, '#dp-track-a'), cv = G.$(root, 'canvas');
  function run(a) {
    var F = { w: [1, a], l: [1, -a], o1: [0, 1.2], o2: [0, -1.2], o3: [0.5, 0] }, keys = Object.keys(F);
    function probs(t) { var z = keys.map(function (k) { return t[0] * F[k][0] + t[1] * F[k][1]; }); var p = G.softmax(z), o = {}; keys.forEach(function (k, i) { o[k] = p[i]; }); return o; }
    var t = [2.5, 0], ts = [2.5, 0], p0 = probs(t), beta = 0.1, lr = 1.2, slr = 0.05, out = { w: [], l: [], s: [], o1: 0, h: 0 };
    for (var i = 0; i <= 300; i++) {
      var p = probs(t), ps = probs(ts);
      var lw = Math.log(p.w / p0.w), ll = Math.log(p.l / p0.l);
      out.w.push(lw); out.l.push(ll); out.s.push(Math.log(ps.w / p0.w));
      var h = lw - ll, g = beta * G.sigmoid(-beta * h);
      t = [t[0] + lr * g * (F.w[0] - F.l[0]), t[1] + lr * g * (F.w[1] - F.l[1])];
      var E = [0, 1].map(function (j) { return keys.reduce(function (acc, k) { return acc + ps[k] * F[k][j]; }, 0); });
      ts = [ts[0] + slr * (F.w[0] - E[0]), ts[1] + slr * (F.w[1] - E[1])];
      out.o1 = p.o1; out.h = h; out.pw = p.w;
    }
    return out;
  }
  function draw() {
    var P = G.pal(), a = parseFloat(sa.value);
    G.$(root, '#dp-track-a-o').textContent = G.fmt(a, 2);
    var r = run(a), all = r.w.concat(r.l).concat(r.s);
    var ymin = Math.min(-1, Math.min.apply(null, all)), ymax = Math.max(1, Math.max.apply(null, all));
    ymin = Math.floor(ymin); ymax = Math.ceil(ymax);
    var c = G.canvas(cv, 250), ctx = c.ctx, pad = { l: 50, r: 14, t: 14, b: 36 };
    var step = Math.max(1, Math.round((ymax - ymin) / 4));
    var yt = []; for (var v = Math.ceil(ymin / step) * step; v <= ymax; v += step) yt.push(v);
    var s = G.axes(ctx, c.w, c.h, pad, { x: [0, 300], y: [ymin, ymax], xt: [0, 100, 200, 300], yt: yt, xl: 'training step', yl: 'Δ log-likelihood vs start' });
    G.line(ctx, [[s.X(0), s.Y(0)], [s.X(300), s.Y(0)]], P.faint, 1, [3, 3]);
    function L(arr, col, dash) { G.line(ctx, arr.map(function (y, i) { return [s.X(i), s.Y(y)]; }), col, 2.5, dash); }
    L(r.s, P.eli5, [6, 4]); L(r.l, P.fp); L(r.w, P.tp);
    G.$(root, '[data-cw]').textContent = (r.w[300] >= 0 ? '+' : '') + G.fmt(r.w[300], 2);
    G.$(root, '[data-cl]').textContent = G.fmt(r.l[300], 2);
    G.$(root, '[data-o1]').textContent = G.pct(r.o1, 1);
    G.$(root, '[data-out]').textContent = (r.w[300] < 0 ?
      'Likelihood displacement: the margin grew to ' + G.fmt(r.h, 1) + ' nats, so preference accuracy looks perfect, yet the chosen response became less likely. ' + G.pct(r.o1, 1) + ' of the probability now sits on a third response neither label mentioned. ' :
      'Chosen and rejected differ enough that DPO raises the chosen response and lowers the rejected one, as intended. ') +
      'SFT on the chosen response (dashed) raises it in every setting.';
  }
  G.on(sa, 'input', draw);
  return draw;
});
