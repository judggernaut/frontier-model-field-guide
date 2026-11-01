/* Chapter 37: Bradley–Terry explorer and reward overoptimization curve */
G.widget('w-rm-bt', function (root) {
  var sd = G.$(root, '#rm-bt-d'), sn = G.$(root, '#rm-bt-n'), st = G.$(root, '#rm-bt-t'), cv = G.$(root, 'canvas');
  var od = G.$(root, '#rm-bt-d-o'), on = G.$(root, '#rm-bt-n-o'), ot = G.$(root, '#rm-bt-t-o');
  var TRUE = [1.5, 0.8, 0.0, -1.0], NAMES = ['A', 'B', 'C', 'D'];

  function fit(n, tau) {
    var r = G.rng(7), k = TRUE.length, w = [], i, j;
    for (i = 0; i < k; i++) { w.push([]); for (j = 0; j < k; j++) w[i].push(0); }
    for (i = 0; i < k; i++) for (j = i + 1; j < k; j++) {
      var p = G.sigmoid((TRUE[i] - TRUE[j]) / tau);
      for (var v = 0; v < n; v++) { if (r() < p) w[i][j]++; else w[j][i]++; }
    }
    var s = [0, 0, 0, 0], lr = 1.5 / (n * (k - 1));
    for (var it = 0; it < 1500; it++) {
      var g = [0, 0, 0, 0];
      for (i = 0; i < k; i++) for (j = 0; j < k; j++) if (i !== j) g[i] += w[i][j] - (w[i][j] + w[j][i]) * G.sigmoid(s[i] - s[j]);
      for (i = 0; i < k; i++) s[i] += lr * (g[i] - 0.02 * n * s[i]);
      var m = G.mean(s); s = s.map(function (x) { return x - m; });
    }
    return s;
  }

  function draw() {
    var P = G.pal(), d = parseFloat(sd.value), n = parseInt(sn.value, 10), tau = parseFloat(st.value);
    od.textContent = G.fmt(d, 1); on.textContent = n; ot.textContent = G.fmt(tau, 1);
    var narrow = (cv.parentElement.clientWidth || 640) < 560, H = narrow ? 480 : 270;
    var c = G.canvas(cv, H), ctx = c.ctx;
    var lw = narrow ? c.w : c.w * 0.46;
    var pL = { l: 44, r: c.w - lw + (narrow ? 12 : 8), t: 22, b: 36 };
    var s1 = G.axes(ctx, c.w, narrow ? 240 : H, pL, { x: [-4, 4], y: [0, 1], xt: [-4, -2, 0, 2, 4], yt: [0, 0.5, 1], xl: 'score gap', yl: 'P(preferred)' });
    var pts = []; for (var x = -4; x <= 4.001; x += 0.1) pts.push([s1.X(x), s1.Y(G.sigmoid(x))]);
    G.line(ctx, pts, P.accent, 2.5);
    G.line(ctx, [[s1.X(d), s1.Y(0)], [s1.X(d), s1.Y(G.sigmoid(d))], [s1.X(-4), s1.Y(G.sigmoid(d))]], P.faint, 1, [4, 3]);
    G.dot(ctx, s1.X(d), s1.Y(G.sigmoid(d)), 6, P.fg, P.surface);
    G.text(ctx, 'logistic link', pL.l + 4, 12, P.muted);

    var f = fit(n, tau), eff = TRUE.map(function (v) { return v / tau; }), me = G.mean(eff); eff = eff.map(function (v) { return v - me; });
    {
      var x0 = narrow ? 44 : c.w * 0.56, x1 = c.w - 12, y0 = narrow ? 290 : 22, y1 = H - 30;
      var amax = Math.max(1, Math.max.apply(null, eff.concat(f).map(Math.abs))) * 1.1;
      var Y = function (v) { return (y0 + y1) / 2 - v / amax * (y1 - y0) / 2; };
      ctx.strokeStyle = P.line; ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x1, Y(0)); ctx.stroke();
      var gw = (x1 - x0) / 4, bw = gw * 0.3;
      for (var i = 0; i < 4; i++) {
        var cx = x0 + gw * (i + 0.5);
        ctx.fillStyle = P.tn; ctx.fillRect(cx - bw - 2, Math.min(Y(0), Y(eff[i])), bw, Math.abs(Y(eff[i]) - Y(0)));
        ctx.fillStyle = P.accent; ctx.fillRect(cx + 2, Math.min(Y(0), Y(f[i])), bw, Math.abs(Y(f[i]) - Y(0)));
        G.text(ctx, NAMES[i], cx, y1 + 14, P.muted, 'center');
      }
      G.text(ctx, 'true score (grey) vs fitted (colour)', x0, y0 - 10, P.muted);
    }
    var correct = 0;
    for (var a = 0; a < 4; a++) for (var b = a + 1; b < 4; b++) if (f[a] > f[b]) correct++;
    G.$(root, '[data-p]').textContent = G.pct(G.sigmoid(Math.abs(d)));
    G.$(root, '[data-acc]').textContent = correct + ' of 6';
    G.$(root, '[data-ad]').textContent = G.pct(G.sigmoid(f[0] - f[3]));
    G.$(root, '[data-out]').textContent = 'True P(A beats D) at this noise is ' + G.pct(G.sigmoid(2.5 / tau)) + '. ' +
      (correct < 6 ? 'With ' + n + ' votes per pair the fitted ranking already flips at least one pair. ' : 'All six pairs are ranked correctly. ') +
      'More noise shrinks every fitted gap toward zero: the reward model learns that even big quality differences win less often.';
  }
  G.on([sd, sn, st], 'input', draw);
  return draw;
});

G.widget('w-rm-oo', function (root) {
  var sq = G.$(root, '#rm-oo-q'), sk = G.$(root, '#rm-oo-k'), cv = G.$(root, 'canvas');
  function gold(d, q) { return d * (1 - (0.3 / q) * d); }
  function proxy(d) { return d * (1.15 - 0.012 * d); }
  function draw() {
    var P = G.pal(), q = parseFloat(sq.value), K = parseFloat(sk.value), db = Math.sqrt(K);
    G.$(root, '#rm-oo-q-o').textContent = G.fmt(q, 1); G.$(root, '#rm-oo-k-o').textContent = K;
    var c = G.canvas(cv, 260), ctx = c.ctx, pad = { l: 46, r: 14, t: 14, b: 36 };
    var s = G.axes(ctx, c.w, c.h, pad, { x: [0, 8], y: [-2, 9], xt: [0, 2, 4, 6, 8], yt: [0, 3, 6, 9], xf: function (t) { return t * t; }, xl: 'KL from reference (nats, √ scale)', yl: 'reward' });
    ctx.fillStyle = P.sunk; ctx.fillRect(s.X(db), pad.t, s.X(8) - s.X(db), c.h - pad.t - pad.b);
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, c.w - pad.l - pad.r, c.h - pad.t - pad.b); ctx.clip();
    var pp = [], gp = [];
    for (var d = 0; d <= 8.001; d += 0.05) { pp.push([s.X(d), s.Y(proxy(d))]); gp.push([s.X(d), s.Y(gold(d, q))]); }
    G.line(ctx, [[s.X(0), s.Y(0)], [s.X(8), s.Y(0)]], P.line, 1);
    G.line(ctx, pp, P.fn, 2.5); G.line(ctx, gp, P.tp, 2.5);
    ctx.restore();
    var dpk = q / 0.6, gpk = gold(dpk, q);
    if (dpk <= 8) { G.dot(ctx, s.X(dpk), s.Y(gpk), 5, P.tp, P.surface); }
    G.line(ctx, [[s.X(db), pad.t], [s.X(db), c.h - pad.b]], P.fg, 1.5, [4, 3]);
    G.dot(ctx, s.X(db), s.Y(Math.max(-2, gold(db, q))), 5, P.fg, P.surface);
    G.text(ctx, 'proxy reward (optimizer sees)', s.X(3.0), s.Y(proxy(3.0)) - 18, P.fn, 'center');
    G.text(ctx, 'gold reward (people want)', s.X(Math.min(dpk, 6)), s.Y(Math.max(gpk, 0.2)) - 14, P.tp, 'center');
    G.$(root, '[data-px]').textContent = G.fmt(proxy(db), 2);
    G.$(root, '[data-gd]').textContent = G.fmt(gold(db, q), 2);
    G.$(root, '[data-pk]').textContent = G.fmt(dpk * dpk, 1);
    var msg;
    if (db > dpk * 1.05) msg = 'You trained past the peak. Gold reward is ' + G.fmt(gpk - gold(db, q), 2) + ' below its best, reached at KL ' + G.fmt(dpk * dpk, 1) + ', while the proxy reports a gain of ' + G.fmt(proxy(db) - proxy(dpk), 2) + ' over that point. The training curve looks like progress.';
    else if (db < dpk * 0.95) msg = 'You stopped before the peak. More KL budget would still help real quality, up to about KL ' + G.fmt(dpk * dpk, 1) + '.';
    else msg = 'You stopped close to the peak. That only happened because you had an independent gold signal; the proxy curve gives no hint where the peak is.';
    G.$(root, '[data-out]').textContent = msg;
  }
  G.on([sq, sk], 'input', draw);
  return draw;
});
