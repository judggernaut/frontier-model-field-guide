/* Chapter 70: confounder explorer and Simpson's paradox */

/* Mix two #rrggbb colours; falls back to the first if either is not hex. */
function czMix(a, b, t) {
  function hx(c) { var m = /^#([0-9a-f]{6})$/i.exec((c || '').trim()); return m ? [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); }) : null; }
  var A = hx(a), B = hx(b); if (!A || !B) return t < 0.5 ? a : b;
  return 'rgb(' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t); }).join(',') + ')';
}

/* Least-squares slope of y on x */
function czSlope(x, y) {
  var mx = G.mean(x), my = G.mean(y), sxy = 0, sxx = 0;
  for (var i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); }
  return sxx > 0 ? sxy / sxx : 0;
}

G.widget('w-cz-confound', function (root) {
  var sc = G.$(root, '#cz-sc'), ss = G.$(root, '#cz-s'), sb = G.$(root, '#cz-b');
  var os = G.$(root, '#cz-s-o'), ob = G.$(root, '#cz-b-o'), bt = G.$(root, '[data-strat]');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  var SC = [
    { x: 'ice cream sales', y: 'drownings', z: 'temperature', lo: 'cold days', hi: 'hot days', sign: 1, b: 0 },
    { x: 'minutes using the new feature', y: 'retention', z: 'prior engagement', lo: 'casual users', hi: 'heavy users', sign: 1, b: 0.2 },
    { x: 'thinking tokens used', y: 'pass rate', z: 'task difficulty', lo: 'easy tasks', hi: 'hard tasks', sign: -1, b: 0.3 }
  ];
  var strat = false, N = 400, NB = 5;
  G.on(bt, 'click', function () { strat = !strat; bt.setAttribute('aria-pressed', strat); draw(); });
  G.on(sc, 'change', function () { sb.value = SC[+sc.value].b; draw(); });

  function draw() {
    var P = G.pal(), s = SC[+sc.value], a = +ss.value, b = +sb.value, c = s.sign * a;
    os.textContent = G.fmt(a, 2); ob.textContent = (b > 0 ? '+' : '') + G.fmt(b, 2);
    // Same seed every draw so the cloud only moves when a slider moves.
    var r = G.rng(70), Z = [], X = [], Y = [], i;
    for (i = 0; i < N; i++) {
      var z = G.gauss(r), x = a * z + G.gauss(r);
      Z.push(z); X.push(x); Y.push(b * x + c * z + 0.7 * G.gauss(r));
    }
    // Naive slope: what a dashboard would show.
    var naive = czSlope(X, Y), rr = naive * Math.sqrt(varOf(X) / varOf(Y));
    // Stratify: five bins of the confounder, pooled within-bin slope.
    var order = Z.map(function (v, j) { return j; }).sort(function (p, q) { return Z[p] - Z[q]; });
    var bin = new Array(N); order.forEach(function (j, rank) { bin[j] = Math.floor(rank * NB / N); });
    var sxy = 0, sxx = 0, bins = [];
    for (var g = 0; g < NB; g++) {
      var xs = [], ys = []; for (i = 0; i < N; i++) if (bin[i] === g) { xs.push(X[i]); ys.push(Y[i]); }
      var mx = G.mean(xs), my = G.mean(ys);
      for (i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
      bins.push({ mx: mx, my: my, sl: czSlope(xs, ys), lo: Math.min.apply(null, xs), hi: Math.max.apply(null, xs) });
    }
    var within = sxy / sxx;
    // Regression adjustment (Frisch-Waugh): residualize X and Y on Z, then take the slope.
    var bxz = czSlope(Z, X), byz = czSlope(Z, Y), mz = G.mean(Z), mxx = G.mean(X), myy = G.mean(Y);
    var rx = X.map(function (v, j) { return v - mxx - bxz * (Z[j] - mz); }), ry = Y.map(function (v, j) { return v - myy - byz * (Z[j] - mz); });
    var adj = czSlope(rx, ry);

    var narrow = (cv.parentElement.clientWidth || 640) < 520, H = narrow ? 300 : 330;
    var cc = G.canvas(cv, H), ctx = cc.ctx;
    function lim(v) { var m = 0; v.forEach(function (t) { m = Math.max(m, Math.abs(t)); }); return Math.max(3, Math.ceil(m * 1.05)); }
    var lx = lim(X), ly = lim(Y), pad = { l: 34, r: 14, t: 30, b: 34 };
    var ax = G.axes(ctx, cc.w, cc.h, pad, { x: [-lx, lx], y: [-ly, ly], xt: [-lx, 0, lx], yt: [-ly, 0, ly], xf: function (t) { return t === 0 ? '0' : (t > 0 ? '+' : '') + t; }, yf: function (t) { return t === 0 ? '0' : (t > 0 ? '+' : '') + t; }, xl: s.x + ' (standardised) →' });
    G.text(ctx, '↑ ' + s.y, pad.l + 6, pad.t - 16, P.muted, 'left', 12);
    var cold = P.eli5, hot = P.lead;
    for (i = 0; i < N; i++) {
      var col = strat ? czMix(cold, hot, bin[i] / (NB - 1)) : P.accent;
      ctx.globalAlpha = strat ? 0.8 : 0.5; G.dot(ctx, ax.X(X[i]), ax.Y(Y[i]), 2.6, col); ctx.globalAlpha = 1;
    }
    // naive line through the means
    function lineAt(mx, my, sl, x0, x1, col, w, dash) { G.line(ctx, [[ax.X(x0), ax.Y(my + sl * (x0 - mx))], [ax.X(x1), ax.Y(my + sl * (x1 - mx))]], col, w, dash); }
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, cc.w - pad.l - pad.r, cc.h - pad.t - pad.b); ctx.clip();
    lineAt(mxx, myy, naive, -lx, lx, P.fg, strat ? 1.5 : 2.5, strat ? [6, 4] : null);
    if (strat) bins.forEach(function (q, g) { lineAt(q.mx, q.my, q.sl, q.lo, q.hi, czMix(cold, hot, g / (NB - 1)), 3); });
    ctx.restore();
    // legend
    var lgx = cc.w - pad.r - (narrow ? 150 : 210);
    if (strat) {
      for (var t = 0; t < 40; t++) { ctx.fillStyle = czMix(cold, hot, t / 39); ctx.fillRect(lgx + t * 2.2, pad.t - 21, 2.4, 9); }
      G.text(ctx, s.lo, lgx - 4, pad.t - 16, P.muted, 'right', 11);
      G.text(ctx, s.hi, lgx + 92, pad.t - 16, P.muted, 'left', 11);
    } else {
      G.text(ctx, 'hidden: ' + s.z, cc.w - pad.r, pad.t - 16, P.faint, 'right', 11.5);
    }
    k('naive').textContent = (naive >= 0 ? '+' : '') + G.fmt(naive, 2);
    k('within').textContent = (within >= 0 ? '+' : '') + G.fmt(within, 2);
    k('adj').textContent = (adj >= 0 ? '+' : '') + G.fmt(adj, 2);
    k('true').textContent = (b >= 0 ? '+' : '') + G.fmt(b, 2);
    var bias = naive - b, flip = (naive > 0.05 && b < -0.05) || (naive < -0.05 && b > 0.05);
    out.innerHTML = 'Correlation r = <b>' + G.fmt(rr, 2) + '</b>. The naive slope says one unit more ' + s.x + ' goes with <b>' + G.fmt(naive, 2) + '</b> units of ' + s.y +
      '; the true causal effect is <b>' + G.fmt(b, 2) + '</b>, so the confounder adds <b>' + (bias >= 0 ? '+' : '') + G.fmt(bias, 2) + '</b>. ' +
      (flip ? 'The confounder has <b>flipped the sign</b>: the raw data point the opposite way from the truth. ' : '') +
      (strat ? 'Within each band of ' + s.z + ' the lines are close to the true slope. Five coarse bands leave a little confounding inside each band (' + G.fmt(within, 2) + '); adjusting for ' + s.z + ' exactly recovers ' + G.fmt(adj, 2) + '.'
        : 'Press <i>Stratify</i> to colour each point by the hidden ' + s.z + ' and fit a line inside each band.');
  }
  function varOf(v) { var m = G.mean(v), t = 0; v.forEach(function (x) { t += (x - m) * (x - m); }); return t / v.length; }
  G.on([ss, sb], 'input', draw);
  return draw;
});

G.widget('w-cz-simpson', function (root) {
  var sa = G.$(root, '#cz-ma'), sbm = G.$(root, '#cz-mb'), oa = G.$(root, '#cz-ma-o'), ob = G.$(root, '#cz-mb-o');
  var bt = G.$(root, '[data-std]'), cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  // Illustrative per-group pass rates: A is better on easy AND on hard tasks.
  var RA = [0.90, 0.45], RB = [0.84, 0.36], NT = 1000, std = false;
  G.on(bt, 'click', function () { std = !std; bt.setAttribute('aria-pressed', std); draw(); });

  function draw() {
    var P = G.pal(), ma = +sa.value / 100, mb = +sbm.value / 100;
    oa.textContent = G.pct(ma); ob.textContent = G.pct(mb);
    var A = (1 - ma) * RA[0] + ma * RA[1], B = (1 - mb) * RB[0] + mb * RB[1];
    var A5 = 0.5 * (RA[0] + RA[1]), B5 = 0.5 * (RB[0] + RB[1]);
    var CA = P.accent, CB = P.lead;
    var narrow = (cv.parentElement.clientWidth || 640) < 560, H = narrow ? 520 : 290;
    var c = G.canvas(cv, H), ctx = c.ctx;
    // Left panel: overall score as a function of the mix. Each model is a straight line.
    var lw = narrow ? c.w : c.w * 0.54, ph = narrow ? 260 : H;
    var p1 = { l: 42, r: c.w - lw + 16, t: 26, b: 36 };
    var s1 = G.axes(ctx, c.w, ph, p1, { x: [0, 1], y: [0.2, 1], xt: [0, 0.25, 0.5, 0.75, 1], yt: [0.2, 0.4, 0.6, 0.8, 1], xf: function (t) { return G.pct(t); }, yf: function (t) { return G.pct(t); }, xl: 'share of hard tasks in the eval set' });
    G.text(ctx, 'overall pass rate depends on the mix', p1.l, 12, P.muted, 'left', 12);
    G.line(ctx, [[s1.X(0), s1.Y(RA[0])], [s1.X(1), s1.Y(RA[1])]], CA, 2.5);
    G.line(ctx, [[s1.X(0), s1.Y(RB[0])], [s1.X(1), s1.Y(RB[1])]], CB, 2.5);
    G.text(ctx, 'A', s1.X(1) + 6, s1.Y(RA[1]), CA, 'left', 12);
    G.text(ctx, 'B', s1.X(1) + 6, s1.Y(RB[1]), CB, 'left', 12);
    if (std) {
      G.line(ctx, [[s1.X(0.5), s1.Y(0.2)], [s1.X(0.5), s1.Y(1)]], P.faint, 1, [4, 4]);
      G.dot(ctx, s1.X(0.5), s1.Y(A5), 6, P.surface, CA); G.dot(ctx, s1.X(0.5), s1.Y(B5), 6, P.surface, CB);
      G.text(ctx, 'same 50/50 mix', s1.X(0.5) + 6, s1.Y(0.24), P.muted, 'left', 11);
    }
    G.dot(ctx, s1.X(ma), s1.Y(A), 7, CA, P.surface); G.dot(ctx, s1.X(mb), s1.Y(B), 7, CB, P.surface);
    G.text(ctx, G.pct(A, 1), s1.X(ma), s1.Y(A) - 15, CA, 'center', 12);
    G.text(ctx, G.pct(B, 1), s1.X(mb), s1.Y(B) + 17, CB, 'center', 12);

    // Right panel: grouped bars.
    var x0 = narrow ? 42 : c.w * 0.6, x1 = c.w - 10, y0 = narrow ? 300 : 26, y1 = H - 40;
    var Yb = function (v) { return y1 - v * (y1 - y0); };
    ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    [0, 0.5, 1].forEach(function (t) { ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(x0, Yb(t)); ctx.lineTo(x1, Yb(t)); ctx.stroke(); ctx.globalAlpha = 1; G.text(ctx, G.pct(t), x0 - 6, Yb(t), P.faint, 'right', 11); });
    var groups = [
      { n: 'easy', a: RA[0], b: RB[0], na: Math.round(NT * (1 - ma)), nb: Math.round(NT * (1 - mb)) },
      { n: 'hard', a: RA[1], b: RB[1], na: Math.round(NT * ma), nb: Math.round(NT * mb) },
      { n: std ? 'same mix' : 'overall', a: std ? A5 : A, b: std ? B5 : B }
    ];
    var gw = (x1 - x0) / 3, bw = Math.min(30, gw * 0.3);
    groups.forEach(function (q, i) {
      var cx = x0 + gw * (i + 0.5);
      ctx.fillStyle = CA; ctx.fillRect(cx - bw - 2, Yb(q.a), bw, Yb(0) - Yb(q.a));
      ctx.fillStyle = CB; ctx.fillRect(cx + 2, Yb(q.b), bw, Yb(0) - Yb(q.b));
      G.text(ctx, G.pct(q.a), cx - bw / 2 - 2, Yb(q.a) - 9, CA, 'center', 11);
      G.text(ctx, G.pct(q.b), cx + bw / 2 + 2, Yb(q.b) - 9, CB, 'center', 11);
      G.text(ctx, q.n, cx, y1 + 13, i === 2 ? P.fg : P.muted, 'center', 12);
      if (q.na !== undefined) G.text(ctx, q.na + ' / ' + q.nb, cx, y1 + 28, P.faint, 'center', 10.5);
    });
    G.text(ctx, 'A', x0 + 4, y0 - 12, CA, 'left', 12); G.text(ctx, 'B', x0 + 22, y0 - 12, CB, 'left', 12);
    G.text(ctx, 'tasks: A / B', x1, y0 - 12, P.faint, 'right', 10.5);

    k('a').textContent = G.pct(A, 1); k('b').textContent = G.pct(B, 1);
    var gap = A - B; k('gap').textContent = (gap >= 0 ? '+' : '') + G.fmt(gap * 100, 1) + ' pts';
    k('std').textContent = '+' + G.fmt((A5 - B5) * 100, 1) + ' pts';
    out.innerHTML = 'Within each group A is ahead: <b>+' + G.fmt((RA[0] - RB[0]) * 100, 0) + '</b> points on easy tasks and <b>+' + G.fmt((RA[1] - RB[1]) * 100, 0) + '</b> on hard ones. ' +
      (gap < 0 ? 'Yet B wins the headline by <b>' + G.fmt(-gap * 100, 1) + ' points</b>, because ' + G.pct(ma) + ' of A\'s tasks are hard against ' + G.pct(mb) + ' of B\'s. That is Simpson\'s paradox: the overall number mostly measures the mix. '
        : 'With these mixes the headline agrees with the groups. Push A\'s hard share up and B\'s down to make it flip. ') +
      'Scored on the same 50/50 mix, A leads by ' + G.fmt((A5 - B5) * 100, 1) + ' points.';
  }
  G.on([sa, sbm], 'input', draw);
  return draw;
});
