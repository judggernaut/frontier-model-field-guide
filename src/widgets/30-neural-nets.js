/* Chapter: Neural networks from the ground up. One-hidden-layer network fitted to a wiggly curve.
   Method: hidden weights and biases are fixed (random, deterministic per seed); output weights and bias
   are solved by ridge-regularized least squares (normal equations, Gaussian elimination). */
G.widget('w-nn-fit', function (root) {
  var sH = G.$(root, '#nn-h'), oH = G.$(root, '#nn-h-o'), sAct = G.$(root, '#nn-act'), sData = G.$(root, '#nn-data');
  var cvFit = G.$(root, 'canvas[data-cv="fit"]'), cvParts = G.$(root, 'canvas[data-cv="parts"]'), out = G.$(root, '[data-out]');
  var kP = G.$(root, '[data-params]'), kTr = G.$(root, '[data-tr]'), kTe = G.$(root, '[data-te]');
  var M = 40, GOLD = 0.6180339887, seed = 5;

  function target(x) { return 0.6 * Math.sin(4 * x) + 0.25 * Math.sin(11 * x + 0.5) + 0.2 * x; }

  // Fixed evaluation grid (the "true curve") and the two training sets.
  var GRID = [], i;
  for (i = 0; i <= 200; i++) GRID.push(-1 + 2 * i / 200);
  var NOISY = (function () {
    var r = G.rng(9), xs = [], ys = [];
    for (var k = 0; k < 20; k++) { var x = -1 + 2 * (k + 0.15 + 0.7 * r()) / 20; xs.push(x); ys.push(target(x) + 0.15 * G.gauss(r)); }
    return { x: xs, y: ys };
  })();

  // Hidden units: unit j computes act(w_j * x + b_j) with b_j = -w_j * c_j, so c_j is where it "turns on".
  // Thresholds follow a golden-ratio sequence so any first H units are spread across the range.
  function makeUnits(s) {
    var r = G.rng(s), off = r(), u = [];
    for (var j = 0; j < M; j++) {
      var sign = r() < 0.5 ? -1 : 1, mag = r(), frac = (off + j * GOLD) % 1;
      u.push({ wr: sign * (0.6 + 1.4 * mag), cr: frac * 2.1 - 1.05, wt: sign * (3 + 7 * mag), ct: frac * 2.2 - 1.1 });
    }
    return u;
  }
  var units = makeUnits(seed);

  function unitFn(act, U) {
    if (act === 'tanh') return function (x) { return Math.tanh(U.wt * (x - U.ct)); };
    if (act === 'none') return function (x) { return U.wr * (x - U.cr); };
    return function (x) { return Math.max(0, U.wr * (x - U.cr)); };
  }

  // Solve (A^T A + lam*n*I') v = A^T y, with the bias column unpenalized.
  function solve(A, y, lam) {
    var n = A.length, p = A[0].length, M2 = [], r, c, k;
    for (r = 0; r < p; r++) { M2.push([]); for (c = 0; c <= p; c++) M2[r].push(0); }
    for (k = 0; k < n; k++) for (r = 0; r < p; r++) {
      var ar = A[k][r]; if (!ar) continue;
      for (c = r; c < p; c++) M2[r][c] += ar * A[k][c];
      M2[r][p] += ar * y[k];
    }
    for (r = 0; r < p; r++) for (c = 0; c < r; c++) M2[r][c] = M2[c][r];
    for (r = 0; r < p - 1; r++) M2[r][r] += lam * n;
    for (c = 0; c < p; c++) {                       // Gaussian elimination with partial pivoting
      var piv = c; for (r = c + 1; r < p; r++) if (Math.abs(M2[r][c]) > Math.abs(M2[piv][c])) piv = r;
      var tmp = M2[c]; M2[c] = M2[piv]; M2[piv] = tmp;
      var d = M2[c][c] || 1e-12;
      for (r = c + 1; r < p; r++) { var f = M2[r][c] / d; if (!f) continue; for (k = c; k <= p; k++) M2[r][k] -= f * M2[c][k]; }
    }
    var v = new Array(p);
    for (r = p - 1; r >= 0; r--) { var s = M2[r][p]; for (k = r + 1; k < p; k++) s -= M2[r][k] * v[k]; v[r] = s / (M2[r][r] || 1e-12); }
    return v;
  }

  function rmse(a, b) { var s = 0; for (var k = 0; k < a.length; k++) s += (a[k] - b[k]) * (a[k] - b[k]); return Math.sqrt(s / a.length); }

  function draw() {
    var P = G.pal(), H = parseInt(sH.value, 10), act = sAct.value, data = sData.value;
    oH.textContent = H;
    var fns = units.slice(0, H).map(function (U) { return unitFn(act, U); });
    var tx = data === 'noisy' ? NOISY.x : GRID, ty = data === 'noisy' ? NOISY.y : GRID.map(target);
    var A = tx.map(function (x) { return fns.map(function (f) { return f(x); }).concat([1]); });
    var lam = act === 'none' ? 1e-4 : (data === 'noisy' ? 1e-8 : 1e-6);
    var v = solve(A, ty, lam), bias = v[H];
    function net(x) { var s = bias; for (var j = 0; j < H; j++) s += v[j] * fns[j](x); return s; }
    var trErr = rmse(tx.map(net), ty), teErr = rmse(GRID.map(net), GRID.map(target));

    // Top: target, fit, data, and where each unit bends.
    var narrow = (cvFit.parentElement.clientWidth || 640) < 520;
    var c = G.canvas(cvFit, narrow ? 220 : 250), ctx = c.ctx, pad = { l: 40, r: 12, t: 26, b: 30 };
    var s = G.axes(ctx, c.w, c.h, pad, { x: [-1, 1], y: [-1.4, 1.4], xt: [-1, -0.5, 0, 0.5, 1], yt: [-1, 0, 1], xl: 'input x' });
    G.line(ctx, GRID.map(function (x) { return [s.X(x), s.Y(target(x))]; }), P.fg, 1.6, [5, 4]);
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t - 6, c.w - pad.l - pad.r, c.h - pad.t - pad.b + 6); ctx.clip();
    G.line(ctx, GRID.map(function (x) { return [s.X(x), s.Y(Math.max(-1.6, Math.min(1.6, net(x))))]; }), P.accent, 2.6);
    ctx.restore();
    if (data === 'noisy') NOISY.x.forEach(function (x, k) { G.dot(ctx, s.X(x), s.Y(NOISY.y[k]), 3.6, P.fp, P.surface); });
    if (act !== 'none') units.slice(0, H).forEach(function (U) {
      var cx = act === 'tanh' ? U.ct : U.cr; if (cx < -1 || cx > 1) return;
      ctx.strokeStyle = P.faint; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s.X(cx), c.h - pad.b); ctx.lineTo(s.X(cx), c.h - pad.b - 7); ctx.stroke();
    });
    var lx = pad.l + 4;
    ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = P.fg; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(lx, 12); ctx.lineTo(lx + 22, 12); ctx.stroke(); ctx.restore();
    G.text(ctx, 'target', lx + 28, 12, P.muted, 'left', 12);
    G.line(ctx, [[lx + 82, 12], [lx + 104, 12]], P.accent, 2.6);
    G.text(ctx, 'network output', lx + 110, 12, P.muted, 'left', 12);
    if (data === 'noisy' && !narrow) { G.dot(ctx, lx + 222, 12, 3.6, P.fp, P.surface); G.text(ctx, 'training points', lx + 232, 12, P.muted, 'left', 12); }

    // Bottom: each unit's contribution v_j * act(w_j x + b_j), and the output (sum plus bias).
    var parts = fns.map(function (f, j) { return GRID.map(function (x) { return v[j] * f(x); }); });
    var mx = 1.4; parts.forEach(function (p) { p.forEach(function (y) { if (Math.abs(y) > mx) mx = Math.abs(y); }); });
    var R = Math.min(6, Math.ceil(mx * 1.05 * 2) / 2), tick = R > 3 ? 2 : (R > 1.5 ? 1 : 0.5), yt = [];
    for (var t = -Math.floor(R / tick) * tick; t <= R + 1e-9; t += tick) yt.push(Math.round(t * 10) / 10);
    var c2 = G.canvas(cvParts, narrow ? 200 : 220), ctx2 = c2.ctx, pad2 = { l: 40, r: 12, t: 26, b: 30 };
    var s2 = G.axes(ctx2, c2.w, c2.h, pad2, { x: [-1, 1], y: [-R, R], xt: [-1, -0.5, 0, 0.5, 1], yt: yt, xl: 'input x' });
    ctx2.save(); ctx2.beginPath(); ctx2.rect(pad2.l, pad2.t, c2.w - pad2.l - pad2.r, c2.h - pad2.t - pad2.b); ctx2.clip();
    ctx2.globalAlpha = H > 15 ? 0.55 : 0.85;
    parts.forEach(function (p, j) { G.line(ctx2, p.map(function (y, k) { return [s2.X(GRID[k]), s2.Y(y)]; }), P.series[(j % 5) + 1], 1.3); });
    ctx2.globalAlpha = 1;
    G.line(ctx2, GRID.map(function (x) { return [s2.X(x), s2.Y(net(x))]; }), P.accent, 2.6);
    ctx2.restore();
    G.text(ctx2, narrow ? 'thin: each unit   thick: sum + bias' : 'thin: one line per hidden unit (output weight × unit)   thick: their sum + bias', pad2.l + 4, 12, P.muted, 'left', 12);

    kP.textContent = G.fmt(3 * H + 1, 0); kTr.textContent = G.fmt(trErr, 3); kTe.textContent = G.fmt(teErr, 3);
    var msg;
    if (act === 'none') msg = '<b>No activation, no curve.</b> Every unit is a straight line, so their sum is a straight line too, with ' + H + ' unit' + (H > 1 ? 's' : '') + ' or 40. Stacked linear pieces collapse into one linear function.';
    else if (data === 'noisy') {
      msg = 'Training error <b>' + G.fmt(trErr, 3) + '</b>, true-curve error <b>' + G.fmt(teErr, 3) + '</b>. The noise in the points has a spread of 0.15, so a training error well below that means the network is fitting the noise. ';
      msg += H >= 14 ? '<b>Overfitting:</b> the extra units bend the curve through individual points, and the gap between the two errors grows.' : 'Add units and watch the two errors part ways.';
    } else {
      msg = 'With ' + H + ' ' + (act === 'relu' ? 'ReLU units the output has up to ' + H + ' corner' + (H > 1 ? 's' : '') + ' (ticks on the axis)' : 'tanh units the output is a sum of ' + H + ' smooth steps (ticks mark their centres)') +
        '. Average miss: <b>' + G.fmt(teErr, 3) + '</b>. ' + (teErr > 0.1 ? 'Add units to add bends.' : 'Close fit. Notice how large some single-unit lines are: units cancel each other, which is normal.');
    }
    out.innerHTML = msg;
  }
  G.on(sH, 'input', draw); G.on([sAct, sData], 'change', draw);
  G.on(G.$(root, '[data-reseed]'), 'click', function () { seed += 1; units = makeUnits(seed); draw(); });
  return draw;
});
