/* Chapter 38: PPO clip visualizer and a closed-form bandit RLHF simulation */
G.widget('w-rl-clip', function (root) {
  var se = G.$(root, '#rl-clip-e'), cv = G.$(root, 'canvas');
  function clip(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function draw() {
    var P = G.pal(), eps = parseFloat(se.value);
    G.$(root, '#rl-clip-e-o').textContent = G.fmt(eps, 2);
    var narrow = (cv.parentElement.clientWidth || 640) < 560, H = narrow ? 480 : 250;
    var c = G.canvas(cv, H), ctx = c.ctx;
    [1, -1].forEach(function (A, k) {
      var pad = narrow ? { l: 46, r: 14, t: 24 + k * 240, b: 36 + (1 - k) * 240 } : { l: 46 + k * c.w / 2, r: 14 + (1 - k) * c.w / 2, t: 24, b: 36 };
      var s = G.axes(ctx, c.w, H, pad, { x: [0, 2], y: A > 0 ? [0, 2] : [-2, 0], xt: [0, 0.5, 1, 1.5, 2], yt: A > 0 ? [0, 1, 2] : [-2, -1, 0], xl: 'probability ratio π_new / π_old', yl: k === 0 || narrow ? 'objective' : '' });
      var x0 = A > 0 ? 1 + eps : 0, x1 = A > 0 ? 2 : 1 - eps;
      ctx.fillStyle = P.sunk; ctx.fillRect(s.X(x0), pad.t, s.X(x1) - s.X(x0), H - pad.t - pad.b);
      var un = [], cl = [];
      for (var r = 0; r <= 2.0001; r += 0.01) {
        un.push([s.X(r), s.Y(r * A)]);
        cl.push([s.X(r), s.Y(Math.min(r * A, clip(r, 1 - eps, 1 + eps) * A))]);
      }
      G.line(ctx, un, P.faint, 1.5, [5, 4]);
      G.line(ctx, cl, A > 0 ? P.tp : P.fp, 2.8);
      G.dot(ctx, s.X(1), s.Y(A), 5, P.fg, P.surface);
      G.text(ctx, A > 0 ? 'advantage > 0 (good action)' : 'advantage < 0 (bad action)', pad.l + 2, pad.t - 12, A > 0 ? P.tp : P.fp);
      G.text(ctx, 'flat: no gradient', (s.X(x0) + s.X(x1)) / 2, A > 0 ? s.Y(0.4) : s.Y(-1.6), P.muted, 'center', 11);
    });
    G.$(root, '[data-out]').textContent = 'With ε = ' + G.fmt(eps, 2) + ', a good action can gain at most a factor of ' + G.fmt(1 + eps, 2) +
      ' in probability per update before its gradient switches off, and a bad action can be cut to ' + G.fmt(1 - eps, 2) +
      ' of its old probability. The pessimistic min keeps the penalty when an update has already gone the wrong way (ratio above 1 for a bad action).';
  }
  G.on(se, 'input', draw);
  return draw;
});

G.widget('w-rl-bandit', function (root) {
  var sb = G.$(root, '#rl-band-b'), sl = G.$(root, '#rl-band-l'), cvs = G.$$(root, 'canvas');
  var R = [
    { n: 'Short, correct', t: 0.8, len: 0.2, ref: 0.30 },
    { n: 'Long, thorough, correct', t: 1.0, len: 0.7, ref: 0.20 },
    { n: 'Long, padded, confident', t: 0.3, len: 1.0, ref: 0.15 },
    { n: 'Short, wrong', t: -0.5, len: 0.1, ref: 0.25 },
    { n: 'Refusal, not needed', t: -0.2, len: 0.15, ref: 0.10 }
  ];
  function solve(beta, bias) {
    var w = R.map(function (r) { return Math.log(r.ref) + (r.t + bias * r.len) / beta; });
    var p = G.softmax(w), kl = 0, tr = 0, px = 0;
    p.forEach(function (pi, i) { if (pi > 0) kl += pi * Math.log(pi / R[i].ref); tr += pi * R[i].t; px += pi * (R[i].t + bias * R[i].len); });
    return { p: p, kl: kl, tr: tr, px: px };
  }
  function draw() {
    var P = G.pal(), beta = Math.pow(10, parseFloat(sb.value)), bias = parseFloat(sl.value);
    G.$(root, '#rl-band-b-o').textContent = beta < 0.1 ? G.fmt(beta, 3) : G.fmt(beta, 2);
    G.$(root, '#rl-band-l-o').textContent = G.fmt(bias, 1);
    var sol = solve(beta, bias);
    // bars: reference vs optimised policy
    var c = G.canvas(cvs[0], 230), ctx = c.ctx, pad = { l: 46, r: 12, t: 16, b: 46 };
    var s = G.axes(ctx, c.w, c.h, pad, { x: [0, R.length], y: [0, 1], yt: [0, 0.5, 1], yf: function (t) { return G.pct(t); }, yl: 'share of responses' });
    var gw = (c.w - pad.l - pad.r) / R.length, bw = Math.min(26, gw * 0.32);
    R.forEach(function (r, i) {
      var cx = pad.l + gw * (i + 0.5);
      ctx.fillStyle = P.tn; ctx.fillRect(cx - bw - 2, s.Y(r.ref), bw, s.Y(0) - s.Y(r.ref));
      ctx.fillStyle = P.accent; ctx.fillRect(cx + 2, s.Y(sol.p[i]), bw, s.Y(0) - s.Y(sol.p[i]));
      var words = r.n.split(', ');
      words.forEach(function (wd, j) { G.text(ctx, wd + (j < words.length - 1 ? ',' : ''), cx, c.h - pad.b + 12 + j * 13, P.muted, 'center', 10.5); });
    });
    G.text(ctx, 'reference policy (grey) vs RLHF policy (colour)', pad.l + 4, 8, P.muted);
    // curves vs beta
    var c2 = G.canvas(cvs[1], 220), ctx2 = c2.ctx, pad2 = { l: 46, r: 14, t: 16, b: 36 };
    var lo = -2, hi = 1, ymax = 1 + bias + 0.2;
    var s2 = G.axes(ctx2, c2.w, c2.h, pad2, { x: [lo, hi], y: [-0.2, ymax], xt: [-2, -1, 0, 1], xf: function (t) { return t === -2 ? '0.01' : t === -1 ? '0.1' : t === 0 ? '1' : '10'; }, yt: [0, Math.round(ymax * 10) / 20, Math.round(ymax * 10) / 10], yf: function (t) { return G.fmt(t, 1); }, xl: 'KL coefficient β (log scale)  ← less restraint', yl: 'expected reward' });
    var tp = [], pp = [];
    for (var v = lo; v <= hi + 1e-9; v += 0.02) { var q = solve(Math.pow(10, v), bias); tp.push([s2.X(v), s2.Y(q.tr)]); pp.push([s2.X(v), s2.Y(q.px)]); }
    G.line(ctx2, pp, P.fn, 2.3); G.line(ctx2, tp, P.tp, 2.3);
    var bv = parseFloat(sb.value);
    G.line(ctx2, [[s2.X(bv), pad2.t], [s2.X(bv), c2.h - pad2.b]], P.fg, 1.2, [4, 3]);
    G.dot(ctx2, s2.X(bv), s2.Y(sol.px), 5, P.fn, P.surface); G.dot(ctx2, s2.X(bv), s2.Y(sol.tr), 5, P.tp, P.surface);
    G.text(ctx2, 'reward model score', s2.X(-1.95), s2.Y(solve(0.0112, bias).px) + 14, P.fn);
    G.text(ctx2, 'true quality', s2.X(0.35), s2.Y(solve(Math.pow(10, 0.35), bias).tr) - 12, P.tp);
    var ref = solve(1e6, bias);
    G.$(root, '[data-kl]').textContent = G.fmt(sol.kl, 2);
    G.$(root, '[data-px]').textContent = (sol.px - ref.px >= 0 ? '+' : '') + G.fmt(sol.px - ref.px, 2);
    G.$(root, '[data-tr]').textContent = (sol.tr - ref.tr >= 0 ? '+' : '') + G.fmt(sol.tr - ref.tr, 2);
    var best = 0; sol.p.forEach(function (x, i) { if (x > sol.p[best]) best = i; });
    G.$(root, '[data-out]').textContent = 'The optimal policy for the KL-regularised objective is π*(y) ∝ π_ref(y)·exp(r(y)/β), computed exactly here. At β = ' +
      (beta < 0.1 ? G.fmt(beta, 3) : G.fmt(beta, 2)) + ' the most common response is "' + R[best].n + '". ' +
      (function () { var bt = -1e9, bb = 0; for (var v = -2; v <= 1.0001; v += 0.02) { var q = solve(Math.pow(10, v), bias); if (q.tr > bt) { bt = q.tr; bb = Math.pow(10, v); } }
        return sol.tr < bt - 0.03 ? 'True quality is ' + G.fmt(bt - sol.tr, 2) + ' below the best achievable here (at β ≈ ' + G.fmt(bb, 2) + '), even though the reward model score is higher. ' : 'This is close to the best true quality this reward model allows. '; })() +
      'Lower β lets the policy move further from the reference (higher KL) and exploit the reward model more.';
  }
  G.on([sb, sl], 'input', draw);
  return draw;
});
