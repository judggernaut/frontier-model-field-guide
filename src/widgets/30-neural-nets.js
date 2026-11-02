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

/* One neuron with two inputs. The plane is shaded by the neuron's output, the dashed line is z = 0,
   and the right panel works through the weighted sum for one selected point. XOR mode shows the limit
   of a single line, and a hand-set two-hidden-neuron network that fixes it. */
G.widget('w-nn-neuron', function (root) {
  var sW1 = G.$(root, '#nr-w1'), sW2 = G.$(root, '#nr-w2'), sB = G.$(root, '#nr-b'), sAct = G.$(root, '#nr-act'), sData = G.$(root, '#nr-data');
  var oW1 = G.$(root, '#nr-w1-o'), oW2 = G.$(root, '#nr-w2-o'), oB = G.$(root, '#nr-b-o');
  var bNext = G.$(root, '[data-next]'), bBest = G.$(root, '[data-best]'), bTwo = G.$(root, '[data-two]');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]'), k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  // Cycling days: x1 = temperature / 10 (so 22 °C is 2.2), x2 = rain in mm per hour. Labels: 1 = good day to cycle.
  var CYCLE = [['Mon', 2.2, 0.2, 1], ['Tue', 1.7, 0, 1], ['Wed', 2.6, 1.0, 1], ['Thu', 0.7, 0.1, 0], ['Fri', 2.7, 2.8, 0], ['Sat', 2.9, 0.5, 1], ['Sun', 1.1, 1.4, 0]];
  // XOR: three points near each corner of a square; "yes" in the two off-diagonal corners.
  var XOR = [], JIT = [[-0.18, 0.12], [0.15, 0.2], [0.05, -0.2]];
  [[1, 1, 0], [2.5, 2.5, 0], [1, 2.5, 1], [2.5, 1, 1]].forEach(function (c) {
    JIT.forEach(function (d) { XOR.push(['', Math.round((c[0] + d[0]) * 100) / 100, Math.round((c[1] + d[1]) * 100) / 100, c[2]]); });
  });
  var LO = 0, HI = 3.5, sel = { cycle: 2, xor: 6 }, two = false, best = {}, geom = null;
  var ACTNAME = { step: 'step', sigmoid: 'sigmoid', relu: 'ReLU' };

  function data() { return sData.value === 'xor' ? XOR : CYCLE; }
  function act(z, a) { return a === 'step' ? (z >= 0 ? 1 : 0) : a === 'relu' ? Math.max(0, z) : G.sigmoid(z); }
  function stp(z) { return z >= 0 ? 1 : 0; }
  // Hand-set two-layer fix: h1 fires when at least one input is high, h2 only when both are; y = h1 AND NOT h2.
  function twoNet(x1, x2) { var h1 = stp(x1 + x2 - 2.75), h2 = stp(x1 + x2 - 4.25); return { h1: h1, h2: h2, y: stp(h1 - h2 - 0.5) }; }
  function nCorrect(w1, w2, b, D) { var n = 0; D.forEach(function (p) { if ((w1 * p[1] + w2 * p[2] + b >= 0) === (p[3] === 1)) n++; }); return n; }
  // Exact display: weights have 1 decimal, inputs at most 2, so 3 decimals is always exact. Trailing zeros trimmed to 2.
  function f(v) { var s = G.fmt(v, 3); if (/\d\.\d\d0$/.test(s)) s = s.slice(0, -1); if (s === '-0.00') s = '0.00'; return s.replace('-', '−'); }
  function f1(v) { return G.fmt(v, 1).replace('-', '−'); }
  function signed(v) { return (v < 0 ? ' − ' : ' + ') + f(Math.abs(v)); }

  // Search every slider setting: most points correct, then the widest gap to the nearest correct point.
  function findBest(D) {
    var top = null;
    for (var i = -20; i <= 20; i++) for (var j = -30; j <= 30; j++) {
      var w1 = i / 10, w2 = j / 10, nw = Math.hypot(w1, w2); if (!nw) continue;
      for (var m = -40; m <= 40; m++) {
        var b = m / 10, n = 0, mg = Infinity;
        for (var q = 0; q < D.length; q++) {
          var z = w1 * D[q][1] + w2 * D[q][2] + b, s = D[q][3] ? z : -z;
          if (s > 0 || (s === 0 && D[q][3])) { n++; mg = Math.min(mg, Math.abs(z) / nw); }
        }
        if (!top || n > top.n || (n === top.n && mg > top.mg)) top = { n: n, mg: mg, w1: w1, w2: w2, b: b };
      }
    }
    return top;
  }

  function draw() {
    var P = G.pal(), w1 = +sW1.value, w2 = +sW2.value, b = +sB.value, a = sAct.value, mode = sData.value, D = data(), isX = mode === 'xor';
    if (!isX) two = false;
    oW1.textContent = f1(w1); oW2.textContent = f1(w2); oB.textContent = f1(b);
    bTwo.style.display = isX ? '' : 'none'; bTwo.setAttribute('aria-pressed', two ? 'true' : 'false');
    bTwo.textContent = two ? 'Back to one neuron' : 'Show the two-neuron fix';
    [sW1, sW2, sB, sAct].forEach(function (e) { e.disabled = two; });
    var W = cv.parentElement.clientWidth || 640, wide = W >= 620, padT = 14, padB = 38, ox = 44;
    var S = Math.max(160, wide ? Math.min(300, Math.floor(W * 0.5) - 60) : Math.min(300, W - ox - 14));
    var c = G.canvas(cv, wide ? S + padT + padB : S + padT + padB + 250), ctx = c.ctx, oy = padT;
    function X(v) { return ox + (v - LO) / (HI - LO) * S; }
    function Y(v) { return oy + S - (v - LO) / (HI - LO) * S; }

    // Shading: colour = which side, strength = how strongly the neuron outputs there.
    var zmax = Math.max(0.5, b + Math.max(0, w1) * HI + Math.max(0, w2) * HI);   // largest z anywhere on the plane
    var cell = 5;
    for (var px = 0; px < S; px += cell) for (var py = 0; py < S; py += cell) {
      var x1 = LO + (px + cell / 2) / S * (HI - LO), x2 = HI - (py + cell / 2) / S * (HI - LO), yes, al;
      if (two) { yes = twoNet(x1, x2).y === 1; al = yes ? 0.2 : 0.12; }
      else {
        var z = w1 * x1 + w2 * x2 + b; yes = z >= 0;
        if (a === 'step') al = yes ? 0.2 : 0.12;
        else if (a === 'sigmoid') { var sg = G.sigmoid(z); al = 0.03 + 0.27 * Math.abs(2 * sg - 1); }
        else al = z > 0 ? 0.05 + 0.27 * Math.min(1, z / zmax) : 0.1;
      }
      ctx.globalAlpha = al; ctx.fillStyle = yes ? P.accent : P.lead;
      ctx.fillRect(ox + px, oy + py, Math.min(cell, S - px), Math.min(cell, S - py));
    }
    ctx.globalAlpha = 1;
    G.axes(ctx, ox + S + 12, oy + S + padB, { l: ox, r: 12, t: oy, b: padB }, {
      x: [LO, HI], y: [LO, HI], xt: [0, 1, 2, 3], yt: [0, 1, 2, 3],
      xf: isX ? null : function (v) { return (v * 10) + ' °C'; }, yf: isX ? null : function (v) { return v + ' mm'; },
      xl: isX ? 'input x₁' : 'temperature (x₁ = °C ÷ 10)', yl: isX ? 'input x₂' : 'rain x₂ (mm per hour)'
    });
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.strokeRect(ox + 0.5, oy + 0.5, S - 1, S - 1);

    // Decision line(s), clipped to the plane.
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, S, S); ctx.clip();
    function boundary(A, B, C, col) {
      if (!A && !B) return;
      var p = Math.abs(B) >= Math.abs(A) ? [[LO, -(A * LO + C) / B], [HI, -(A * HI + C) / B]] : [[-(B * LO + C) / A, LO], [-(B * HI + C) / A, HI]];
      G.line(ctx, [[X(p[0][0]), Y(p[0][1])], [X(p[1][0]), Y(p[1][1])]], col, 2, [6, 5]);
    }
    if (two) { boundary(1, 1, -2.75, P.fg); boundary(1, 1, -4.25, P.fg); }
    else {
      boundary(w1, w2, b, P.fg);
      var nw = Math.hypot(w1, w2);
      if (nw > 0) {   // the weight vector is perpendicular to the line and points toward "yes"
        var t = (w1 * 1.75 + w2 * 1.75 + b) / (nw * nw), qx = 1.75 - t * w1, qy = 1.75 - t * w2;
        if (qx > 0.25 && qx < HI - 0.25 && qy > 0.25 && qy < HI - 0.25) {
          var ex = qx + 0.5 * w1 / nw, ey = qy + 0.5 * w2 / nw, A0 = [X(qx), Y(qy)], A1 = [X(ex), Y(ey)];
          G.line(ctx, [A0, A1], P.accent, 2);
          var ang = Math.atan2(A1[1] - A0[1], A1[0] - A0[0]);
          ctx.beginPath(); ctx.moveTo(A1[0], A1[1]);
          ctx.lineTo(A1[0] - 8 * Math.cos(ang - 0.45), A1[1] - 8 * Math.sin(ang - 0.45));
          ctx.lineTo(A1[0] - 8 * Math.cos(ang + 0.45), A1[1] - 8 * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fillStyle = P.accent; ctx.fill();
          G.text(ctx, 'w', A1[0] + 9 * Math.cos(ang), A1[1] + 9 * Math.sin(ang), P.accent, 'center', 12);
        }
      }
    }
    ctx.restore();
    if (two) {
      G.text(ctx, 'h₁ line', X(2.63) - 8, Y(0.12), P.fg, 'right', 11.5);
      G.text(ctx, 'h₂ line', X(HI) - 4, Y(4.25 - HI) + 14, P.fg, 'right', 11.5);
    }

    // Points.
    var si = sel[mode], pts = [];
    D.forEach(function (p, i) {
      var x = X(p[1]), y = Y(p[2]), ok = two ? twoNet(p[1], p[2]).y === p[3] : ((w1 * p[1] + w2 * p[2] + b >= 0) === (p[3] === 1));
      pts.push([x, y]);
      if (!ok) { ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = P.fg; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.stroke(); ctx.restore(); }
      if (p[3]) G.dot(ctx, x, y, 6, P.accent, P.surface);
      else { ctx.fillStyle = P.lead; ctx.fillRect(x - 5.5, y - 5.5, 11, 11); ctx.strokeStyle = P.surface; ctx.lineWidth = 2; ctx.strokeRect(x - 5.5, y - 5.5, 11, 11); }
      if (i === si) { ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.stroke(); }
      if (p[0]) G.text(ctx, p[0], x + 10, y - 11, P.fg, 'left', 12);
    });
    geom = pts;

    // Right (or lower) panel: the computation for the selected point.
    var p = D[si], x1s = p[1], x2s = p[2];
    var rx = wide ? ox + S + 40 : 8, ry = wide ? oy : oy + S + padB + 8, rw = wide ? W - rx - 4 : W - 16;
    var mono = '12px ' + G.css('--font-mono', 'monospace');
    function node(x, y, r, label, top, col) {
      G.dot(ctx, x, y, r, P.surface, col || P.line);
      G.text(ctx, label, x, y, P.fg, 'center', 12);
      if (top) G.text(ctx, top, x, y - r - 9, P.muted, 'center', 11.5);
    }
    function edge(x0, y0, x1, y1, wv, lab, lx, ly) {
      var col = wv >= 0 ? P.accent : P.lead;
      G.line(ctx, [[x0, y0], [x1, y1]], col, 1 + 1.6 * Math.min(2, Math.abs(wv)));
      if (lab) G.text(ctx, lab, lx, ly, col, 'center', 11.5);
    }
    function lines(L, y0) {
      ctx.font = mono; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      L.forEach(function (s, i) { ctx.fillStyle = i === L.length - 1 ? P.fg : P.muted; ctx.fillText(s, rx + 4, y0 + i * 20); });
    }
    var who = isX ? 'Selected point' : p[0] + ': ' + G.fmt(x1s * 10, 0) + ' °C, ' + G.fmt(x2s, 1) + ' mm/h rain', yv, zv, verdict;
    G.text(ctx, who + (p[3] ? ' (labelled yes)' : ' (labelled no)'), rx + 4, ry + 6, P.fg, 'left', 12.5);
    var inX = rx + 26, y1n = ry + 50, y2n = ry + 120;
    if (!two) {
      zv = w1 * x1s + w2 * x2s + b; yv = act(zv, a);
      var sx = rx + Math.max(120, rw * 0.46), bx = rx + Math.max(200, rw * 0.74), my = ry + 85;
      edge(inX + 18, y1n, sx - 22, my, w1, 'w₁ = ' + f1(w1), (inX + sx) / 2 + 4, (y1n + my) / 2 - 12);
      edge(inX + 18, y2n, sx - 22, my, w2, 'w₂ = ' + f1(w2), (inX + sx) / 2 + 4, (y2n + my) / 2 + 12);
      G.line(ctx, [[sx, my - 46], [sx, my - 23]], P.muted, 1.5);
      G.text(ctx, 'b = ' + f1(b), sx, my - 54, P.muted, 'center', 11.5);
      node(inX, y1n, 18, f(x1s), 'x₁'); node(inX, y2n, 18, f(x2s), 'x₂');
      node(sx, my, 22, 'Σ', null, P.fg);
      G.text(ctx, 'z = ' + f(zv), sx, my + 34, P.fg, 'center', 12);
      G.line(ctx, [[sx + 22, my], [bx - 34, my]], P.muted, 1.5);
      // activation icon: the curve, with the current z marked
      var bw = 64, bh = 46, bl = bx - bw / 2, bt = my - bh / 2, zr = 4, ytop = a === 'relu' ? 4 : 1;
      ctx.fillStyle = P.surface; ctx.fillRect(bl, bt, bw, bh); ctx.strokeStyle = P.fg; ctx.lineWidth = 1; ctx.strokeRect(bl + 0.5, bt + 0.5, bw - 1, bh - 1);
      var curve = []; for (var q = 0; q <= 40; q++) { var zz = -zr + 2 * zr * q / 40; curve.push([bl + 4 + (bw - 8) * q / 40, bt + bh - 5 - (bh - 10) * Math.min(1, act(zz, a) / ytop)]); }
      if (a === 'step') curve = [[bl + 4, bt + bh - 5], [bl + bw / 2, bt + bh - 5], [bl + bw / 2, bt + 5], [bl + bw - 4, bt + 5]];
      G.line(ctx, curve, P.accent, 1.8);
      var zc = Math.max(-zr, Math.min(zr, zv));
      G.dot(ctx, bl + 4 + (bw - 8) * (zc + zr) / (2 * zr), bt + bh - 5 - (bh - 10) * Math.min(1, act(zc, a) / ytop), 3.5, P.fg);
      G.text(ctx, ACTNAME[a], bx, bt - 9, P.muted, 'center', 11.5);
      G.text(ctx, 'y = ' + f(yv), bx, my + 34, P.fg, 'center', 12);
      verdict = a === 'step' ? (yv ? 'yes' : 'no') : a === 'sigmoid' ? (yv >= 0.5 ? '≥ 0.5, yes' : '< 0.5, no') : (yv > 0 ? '> 0, fires: yes' : '= 0, silent: no');
      lines([
        'w₁·x₁ = ' + f1(w1) + ' × ' + f(x1s) + ' = ' + f(w1 * x1s),
        'w₂·x₂ = ' + f1(w2) + ' × ' + f(x2s) + ' = ' + f(w2 * x2s),
        'z = ' + f(w1 * x1s) + signed(w2 * x2s) + signed(b) + ' = ' + f(zv),
        'y = ' + ACTNAME[a] + '(' + f(zv) + ') = ' + f(yv) + ', ' + verdict
      ], ry + 160);
    } else {
      var tn = twoNet(x1s, x2s), hx = rx + Math.max(130, rw * 0.46), oxn = rx + Math.max(220, rw * 0.8), omy = ry + 85;
      [[y1n, tn.h1, '−2.75', 'h₁'], [y2n, tn.h2, '−4.25', 'h₂']].forEach(function (h) {
        edge(inX + 18, y1n, hx - 18, h[0], 1); edge(inX + 18, y2n, hx - 18, h[0], 1);
      });
      edge(hx + 18, y1n, oxn - 20, omy, 1, '+1', (hx + oxn) / 2, (y1n + omy) / 2 - 12);
      edge(hx + 18, y2n, oxn - 20, omy, -1, '−1', (hx + oxn) / 2, (y2n + omy) / 2 + 12);
      node(inX, y1n, 18, f(x1s), 'x₁'); node(inX, y2n, 18, f(x2s), 'x₂');
      node(hx, y1n, 18, String(tn.h1), 'h₁, b = −2.75', P.fg); node(hx, y2n, 18, String(tn.h2), null, P.fg);
      G.text(ctx, 'h₂, b = −4.25', hx, y2n + 30, P.muted, 'center', 11.5);
      node(oxn, omy, 20, String(tn.y), 'y, b = −0.5', P.fg);
      zv = tn.h1 - tn.h2 - 0.5; yv = tn.y;
      lines([
        'every weight from x₁, x₂ into h₁, h₂ is 1',
        'h₁ = step(x₁+x₂−2.75) = step(' + f(x1s + x2s - 2.75) + ') = ' + tn.h1,
        'h₂ = step(x₁+x₂−4.25) = step(' + f(x1s + x2s - 4.25) + ') = ' + tn.h2,
        'y = step(h₁−h₂−0.5) = step(' + f(zv) + ') = ' + tn.y + (tn.y ? ', yes' : ', no')
      ], ry + 165);
    }

    // Cards and readout.
    var n = two ? D.filter(function (q) { return twoNet(q[1], q[2]).y === q[3]; }).length : nCorrect(w1, w2, b, D), N = D.length;
    k('acc').textContent = G.fmt(n, 0) + ' / ' + G.fmt(N, 0); k('z').textContent = f(zv); k('y').textContent = f(yv);
    var msg;
    if (two) {
      msg = '<b>Two hidden neurons get all ' + G.fmt(N, 0) + ' points right.</b> h₁ fires when x₁ + x₂ is above 2.75 (at least one input is high). h₂ fires only above 4.25 (both are high). The output neuron says yes when h₁ fires and h₂ does not, which is exactly "one high, not both". Each hidden neuron still draws one straight line; the second layer combines the two lines into a band. These weights are set by hand here. Training finds weights like them automatically, which is the subject of <a href="#learning">the next chapter</a>.';
    } else if (isX) {
      var bx2 = best.xor || (best.xor = findBest(XOR));
      msg = 'This line gets <b>' + G.fmt(n, 0) + ' of ' + G.fmt(N, 0) + '</b> points right. The best any single line can do here is <b>' + G.fmt(bx2.n, 0) + ' of ' + G.fmt(N, 0) +
        '</b> ("Find the best single line" searches every slider setting). The yes points sit in opposite corners, and a straight line always leaves at least one corner group on the wrong side. ' +
        'One neuron can only draw one straight boundary, whatever its activation. Stacking neurons in layers fixes this: press "Show the two-neuron fix", then read the Layers section further down this chapter and <a href="#learning">how weights are learned</a>.';
    } else {
      var zs = w1 * x1s + w2 * x2s + b, okSel = (zs >= 0) === (p[3] === 1);
      msg = '<b>' + p[0] + '</b> has z = ' + f(zs) + ', so it lands on the <b>' + (zs >= 0 ? 'yes' : 'no') + '</b> side' + (okSel ? ', matching its label.' : ', but it is labelled ' + (p[3] ? 'yes' : 'no') + ': it is misclassified (dashed ring).') + ' ' +
        (n === N ? 'All ' + G.fmt(N, 0) + ' days are on the correct side: a straight line can separate good days from bad ones, so one neuron is enough. ' : G.fmt(n, 0) + ' of ' + G.fmt(N, 0) + ' days are on the correct side. Try a smaller rain penalty (w₂ closer to 0) or a different bias. ') +
        'The weights set the tilt of the line (the arrow w is perpendicular to it and points toward yes); the bias slides it. ' +
        (a === 'step' ? 'Step gives a hard 0 or 1, so the shading is flat on each side.' : a === 'sigmoid' ? 'Sigmoid fades near the line: the neuron is unsure there and confident far away.' : 'ReLU is exactly 0 on the no side and grows the further you go past the line.') +
        ' Changing the activation never moves the line; it only changes how the output behaves on each side.';
    }
    out.innerHTML = msg;
  }

  function setSlider(s, v) { s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }
  G.on([sW1, sW2, sB], 'input', draw);
  G.on([sAct, sData], 'change', draw);
  G.on(bNext, 'click', function () { var m = sData.value; sel[m] = (sel[m] + 1) % data().length; draw(); });
  G.on(bTwo, 'click', function () { two = !two; draw(); });
  G.on(bBest, 'click', function () {
    var m = sData.value, r = best[m] || (best[m] = findBest(data()));
    two = false; setSlider(sW1, r.w1); setSlider(sW2, r.w2); setSlider(sB, r.b);
  });
  cv.addEventListener('click', function (e) {
    if (!geom) return;
    var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, bi = -1, bd = 16;
    geom.forEach(function (p, i) { var d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0) { sel[sData.value] = bi; draw(); }
  });
  return draw;
});
