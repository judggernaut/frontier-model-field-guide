/* Chapter: How networks learn. 1D gradient descent on a bumpy loss, and a 2D saddle. */
G.widget('w-gd-ball', function (root) {
  var sX = G.$(root, '#gd-x0'), sLr = G.$(root, '#gd-lr'), sMom = G.$(root, '#gd-mom'), cNoise = G.$(root, '#gd-noise');
  var oX = G.$(root, '#gd-x0-o'), oLr = G.$(root, '#gd-lr-o'), oMom = G.$(root, '#gd-mom-o');
  var cvL = G.$(root, 'canvas[data-cv="land"]'), cvC = G.$(root, 'canvas[data-cv="curve"]'), out = G.$(root, '[data-out]');
  var bStep = G.$(root, '[data-step]'), bRun = G.$(root, '[data-run]'), bReset = G.$(root, '[data-reset]');
  var kIt = G.$(root, '[data-it]'), kTh = G.$(root, '[data-th]'), kLo = G.$(root, '[data-lo]'), kEnd = G.$(root, '[data-end]');
  var T = 150, XMIN = -4, XMAX = 4, SIGMA = 5, NOISE_SEED = 22, seed = NOISE_SEED;
  var PRESETS = {
    stuck: [-3.4, -1, 0, false], other: [1.2, -1, 0, false], mom: [-3.4, -1, 0.95, false],
    noise: [-3.4, -1, 0, true], big: [1.0, Math.log10(0.8), 0, false]
  };
  // Loss: a gentle bowl with three valleys and two hills. Gradient is analytic.
  var B = [[-1.7, 2.2, 0.6], [-1.05, -2.5, 0.7], [-0.45, -0.2, 0.15], [0.5, 0.8, 0.25]];
  function L(t) { var s = 0.12 * t * t + 0.004 * t * t * t * t; B.forEach(function (b) { s += b[0] * Math.exp(-(t - b[1]) * (t - b[1]) / b[2]); }); return s; }
  function dL(t) { var s = 0.24 * t + 0.016 * t * t * t; B.forEach(function (b) { s += b[0] * Math.exp(-(t - b[1]) * (t - b[1]) / b[2]) * (-2 * (t - b[1]) / b[2]); }); return s; }
  // Critical points, found once by scanning for sign changes of the slope.
  var CRIT = [];
  (function () {
    var prev = dL(XMIN), x;
    for (var i = 1; i <= 8000; i++) {
      x = XMIN + i * 0.001; var d = dL(x);
      if ((prev < 0) !== (d < 0)) CRIT.push({ x: x, min: prev < 0 });
      prev = d;
    }
    var mins = CRIT.filter(function (c) { return c.min; }), g = mins.reduce(function (a, c) { return L(c.x) < L(a.x) ? c : a; }, mins[0]);
    CRIT.forEach(function (c) { c.global = c === g; c.label = c.min ? (c.global ? 'global min' : 'local min') : 'local max'; });
  })();
  var MAXES = CRIT.filter(function (c) { return !c.min; }).map(function (c) { return c.x; });
  function basinOf(t) { var mins = CRIT.filter(function (c) { return c.min; }); var k = 0; MAXES.forEach(function (m) { if (t > m) k++; }); return mins[k]; }

  var path = [], k = 0, timer = null, last = 0;
  // Noise on the slope fades linearly over the run, the way a decaying learning rate damps SGD noise.
  function trajectory(sd) {
    var x0 = parseFloat(sX.value), eta = Math.pow(10, parseFloat(sLr.value)), beta = parseFloat(sMom.value), noisy = cNoise.checked;
    var r = G.rng(sd), t = x0, v = 0, pth = [{ t: t, l: L(t) }];
    for (var i = 0; i < T; i++) {
      var g = dL(t) + (noisy ? SIGMA * (1 - i / T) * G.gauss(r) : 0);
      v = beta * v + g; t -= eta * v;                     // momentum: v is a running sum of past slopes
      if (!isFinite(t) || t < XMIN - 0.5 || t > XMAX + 0.5) { pth.push({ t: t, l: NaN, div: true }); break; }
      pth.push({ t: t, l: L(t) });
    }
    return pth;
  }
  function simulate() { path = trajectory(seed); }
  // With noise on, one run is one draw. Summarise 40 draws so the reader sees odds, not luck.
  function tally() {
    var n = 40, cnt = { g: 0, l: 0, d: 0 };
    for (var sd = 1; sd <= n; sd++) {
      var p = trajectory(1000 + sd), e = p[p.length - 1];
      if (e.div) cnt.d++; else if (basinOf(e.t).global) cnt.g++; else cnt.l++;
    }
    return ' <span class="small">Across 40 noise draws from this start: <b>' + G.pct(cnt.g / n) + '</b> end in the global minimum, ' + G.pct(cnt.l / n) + ' in a local one' + (cnt.d ? ', ' + G.pct(cnt.d / n) + ' diverge' : '') + '. Press Reset for a new draw.</span>';
  }
  function stop() { if (timer) { cancelAnimationFrame(timer); timer = null; } bRun.textContent = 'Run'; bRun.setAttribute('aria-pressed', 'false'); }
  function outcome(i) {
    var p = path[i];
    if (p.div) return { short: 'Diverged', text: '<b>Diverged.</b> The steps were so large that the ball was thrown off the map. Lower the learning rate.' };
    if (i === 0) return { short: 'Not started', text: 'The ball sits at the start. Press <b>Step</b> for one update or <b>Run</b> to watch it roll.' };
    var b = basinOf(p.t), settled = Math.abs(dL(p.t)) < 0.02 && Math.abs(p.t - path[i - 1].t) < 0.002;
    if (i < path.length - 1 && !settled) return { short: 'Rolling', text: 'Still moving. Each step moves the ball by learning rate × slope' + (parseFloat(sMom.value) > 0 ? ', plus momentum carried over from earlier steps.' : '.') };
    var where = b.global ? 'the global minimum' : 'a local minimum at θ = ' + G.fmt(b.x, 2);
    var tail = b.global ? ' This is the lowest point on the whole curve.' : ' The global minimum is at θ = ' + G.fmt(CRIT.filter(function (c) { return c.global; })[0].x, 2) + ', but every nearby step goes uphill, so plain descent stays put. Try another start, momentum, or noise.';
    if (!settled) return { short: b.global ? 'Near global min' : 'Near local min', text: 'After ' + (path.length - 1) + ' steps the ball is still bouncing around ' + where + '.' + (b.global ? '' : tail) };
    return { short: b.global ? 'Global min' : 'Local min', text: '<b>Settled in ' + where + '</b> after ' + i + ' steps, loss ' + G.fmt(p.l, 3) + '.' + tail };
  }
  function draw() {
    var P = G.pal(), eta = Math.pow(10, parseFloat(sLr.value));
    oX.textContent = G.fmt(parseFloat(sX.value), 1); oLr.textContent = eta < 0.1 ? G.fmt(eta, 3) : G.fmt(eta, 2); oMom.textContent = G.fmt(parseFloat(sMom.value), 2);
    var narrow = (cvL.parentElement.clientWidth || 640) < 520;
    var c = G.canvas(cvL, narrow ? 240 : 270), ctx = c.ctx, pad = { l: 40, r: 12, t: 30, b: 32 };
    var s = G.axes(ctx, c.w, c.h, pad, { x: [XMIN, XMAX], y: [-1.4, 3.1], xt: [-4, -2, 0, 2, 4], yt: [-1, 0, 1, 2, 3], xl: 'parameter θ (one weight)', yl: 'loss' });
    var pts = []; for (var x = XMIN; x <= XMAX + 1e-9; x += 0.02) pts.push([s.X(x), s.Y(L(x))]);
    G.line(ctx, pts, P.fg, 2.2);
    CRIT.forEach(function (cp) {
      var X = s.X(cp.x), Y = s.Y(L(cp.x)), col = cp.global ? P.good : (cp.min ? P.fn : P.muted);
      G.dot(ctx, X, Y, 3.5, col);
      if (!narrow || cp.global) G.text(ctx, cp.label, X, cp.min ? Y + 16 : Y - 14, col, 'center', 12);
    });
    var upto = Math.min(k, path.length - 1);
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t - 10, c.w - pad.l - pad.r, c.h - pad.t - pad.b + 10); ctx.clip();
    for (var i = 0; i < upto; i++) if (!path[i].div) G.dot(ctx, s.X(path[i].t), s.Y(path[i].l) - 7, 2.2, P.accent);
    ctx.restore();
    G.dot(ctx, s.X(path[0].t), s.Y(path[0].l) - 7, 3, P.faint);
    var cur = path[upto];
    if (!cur.div) {
      G.dot(ctx, s.X(cur.t), s.Y(cur.l) - 8, 7, P.accent, P.surface);
      if (upto === 0) G.text(ctx, 'start', s.X(cur.t), s.Y(cur.l) - 24, P.accent, 'center', 12);
    }
    // Loss against iteration.
    var c2 = G.canvas(cvC, 130), ctx2 = c2.ctx, pad2 = { l: 40, r: 12, t: 12, b: 30 };
    var s2 = G.axes(ctx2, c2.w, c2.h, pad2, { x: [0, T], y: [-1.4, 3.1], xt: [0, 50, 100, 150], yt: [-1, 1, 3], xl: 'iteration', yl: 'loss' });
    var gl = L(CRIT.filter(function (cp) { return cp.global; })[0].x);
    G.line(ctx2, [[s2.X(0), s2.Y(gl)], [s2.X(T), s2.Y(gl)]], P.good, 1, [4, 4]);
    G.text(ctx2, 'global min', s2.X(T) - 4, s2.Y(gl) - 8, P.good, 'right', 12);
    var lp = []; for (i = 0; i <= upto; i++) if (!path[i].div) lp.push([s2.X(i), s2.Y(Math.min(3.1, path[i].l))]);
    G.line(ctx2, lp, P.accent, 2);
    var o = outcome(upto);
    kIt.textContent = G.fmt(upto, 0); kTh.textContent = cur.div ? '—' : G.fmt(cur.t, 2); kLo.textContent = cur.div ? '—' : G.fmt(cur.l, 3); kEnd.textContent = o.short;
    out.innerHTML = o.text + (cNoise.checked && (upto === path.length - 1) ? tally() : '');
  }
  function reset(showAll) { stop(); simulate(); k = showAll ? path.length - 1 : 0; draw(); }
  function tick(now) {
    if (now - last >= 70) { last = now; k++; draw(); }
    if (k >= path.length - 1) { stop(); draw(); return; }
    timer = requestAnimationFrame(tick);
  }
  G.on(bStep, 'click', function () { stop(); if (k < path.length - 1) k++; draw(); });
  G.on(bRun, 'click', function () {
    if (timer) { stop(); return; }
    if (k >= path.length - 1) k = 0;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { k = path.length - 1; draw(); return; }
    bRun.textContent = 'Pause'; bRun.setAttribute('aria-pressed', 'true'); last = 0; timer = requestAnimationFrame(tick);
  });
  G.on(bReset, 'click', function () { seed += 1; reset(false); });
  G.on([sX, sLr, sMom], 'input', function () { reset(false); });
  G.on(cNoise, 'change', function () { reset(false); });
  G.$$(root, '[data-preset]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var p = PRESETS[btn.dataset.preset]; seed = NOISE_SEED; sX.value = p[0]; sLr.value = p[1]; sMom.value = p[2]; cNoise.checked = p[3];
      G.$$(root, '[data-preset]').forEach(function (b2) { b2.setAttribute('aria-pressed', b2 === btn ? 'true' : 'false'); });
      reset(false);
    });
  });
  simulate(); k = path.length - 1;   // default view: the finished run, so the printed page shows an outcome
  return draw;
});

G.widget('w-gd-saddle', function (root) {
  var sY = G.$(root, '#gd-y0'), oY = G.$(root, '#gd-y0-o'), cNoise = G.$(root, '#gd-snoise');
  var cvS = G.$(root, 'canvas[data-cv="sad"]'), cvC = G.$(root, 'canvas[data-cv="sadloss"]'), out = G.$(root, '[data-out]');
  var kNear = G.$(root, '[data-near]'), kFin = G.$(root, '[data-fin]');
  var ETA = 0.05, T = 300, X0 = 1.6;
  // f(x, y) = x^2 + 0.5 (y^2 - 1)^2: minima at (0, ±1), a saddle at (0, 0) with loss 0.5.
  function f(x, y) { var q = y * y - 1; return x * x + 0.5 * q * q; }
  function grad(x, y) { return [2 * x, 2 * y * (y * y - 1)]; }
  function draw() {
    var P = G.pal(), y0 = Math.pow(10, parseFloat(sY.value)), noisy = cNoise.checked;
    oY.textContent = '1e' + G.fmt(parseFloat(sY.value), 1).replace('.0', '');
    var r = G.rng(11), x = X0, y = y0, pts = [[x, y]], ls = [f(x, y)], near = 0;
    for (var i = 0; i < T; i++) {
      var g = grad(x, y);
      if (noisy) { g[0] += 0.4 * G.gauss(r); g[1] += 0.4 * G.gauss(r); }
      x -= ETA * g[0]; y -= ETA * g[1];
      pts.push([x, y]); ls.push(f(x, y));
      if (Math.abs(f(x, y) - 0.5) < 0.02 && Math.abs(y) < 0.2) near++;
    }
    var narrow = (cvS.parentElement.clientWidth || 640) < 520;
    var c = G.canvas(cvS, narrow ? 240 : 270), ctx = c.ctx, pad = { l: 40, r: 12, t: 14, b: 32 };
    var s = G.axes(ctx, c.w, c.h, pad, { x: [-2, 2], y: [-1.7, 1.7], xt: [-2, -1, 0, 1, 2], yt: [-1, 0, 1], xl: 'weight 1 (x)', yl: 'weight 2 (y)' });
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, c.w - pad.l - pad.r, c.h - pad.t - pad.b); ctx.clip();
    [0.05, 0.2, 0.5, 0.9, 1.5, 2.4, 3.5].forEach(function (lv) {
      // Level set x = ±sqrt(lv - 0.5 (y^2 - 1)^2), traced as closed loops over each run of valid y.
      var run = [], N = 500, j, yy, xx;
      function flush() {
        if (run.length > 1) {
          var loop = run.map(function (p) { return [s.X(p[0]), s.Y(p[1])]; });
          for (var m = run.length - 1; m >= 0; m--) loop.push([s.X(-run[m][0]), s.Y(run[m][1])]);
          loop.push(loop[0]);
          G.line(ctx, loop, lv === 0.5 ? P.faint : P.line, lv === 0.5 ? 1.6 : 1.2, lv === 0.5 ? [5, 4] : null);
        }
        run = [];
      }
      for (j = 0; j <= N; j++) {
        yy = -1.9 + 3.8 * j / N; var q = yy * yy - 1, rem = lv - 0.5 * q * q;
        if (rem >= 0) { xx = Math.sqrt(rem); run.push([xx, yy]); } else flush();
      }
      flush();
    });
    G.line(ctx, pts.map(function (p) { return [s.X(p[0]), s.Y(p[1])]; }), P.accent, 2);
    ctx.restore();
    [[0, 1], [0, -1]].forEach(function (m) { G.dot(ctx, s.X(m[0]), s.Y(m[1]), 4.5, P.good); G.text(ctx, 'minimum', s.X(m[0]) + 10, s.Y(m[1]), P.good, 'left', 12); });
    G.dot(ctx, s.X(0), s.Y(0), 4.5, P.warn); G.text(ctx, 'saddle', s.X(0) - 10, s.Y(0) - 12, P.warn, 'right', 12);
    G.dot(ctx, s.X(X0), s.Y(pts[0][1]), 4.5, P.fp, P.surface); G.text(ctx, 'start', s.X(X0) + 2, s.Y(pts[0][1]) + 14, P.fp, 'center', 12);
    var end = pts[pts.length - 1];
    G.dot(ctx, s.X(end[0]), s.Y(end[1]), 5, P.accent, P.surface);
    var c2 = G.canvas(cvC, 130), ctx2 = c2.ctx, pad2 = { l: 40, r: 12, t: 12, b: 30 };
    var s2 = G.axes(ctx2, c2.w, c2.h, pad2, { x: [0, T], y: [0, 3], xt: [0, 100, 200, 300], yt: [0, 0.5, 1, 2, 3], xl: 'iteration', yl: 'loss' });
    G.line(ctx2, [[s2.X(0), s2.Y(0.5)], [s2.X(T), s2.Y(0.5)]], P.warn, 1, [4, 4]);
    G.text(ctx2, 'saddle height', s2.X(T) - 4, s2.Y(0.5) - 9, P.warn, 'right', 12);
    G.line(ctx2, ls.map(function (l, i2) { return [s2.X(i2), s2.Y(Math.min(3, l))]; }), P.accent, 2);
    kNear.textContent = G.fmt(near, 0);
    var escaped = ls[ls.length - 1] < 0.1;
    kFin.textContent = escaped ? 'minimum' : 'at the saddle';
    out.innerHTML = (escaped ? 'The ball ' + (near > 10 ? 'sat on the plateau for about <b>' + near + '</b> steps, then escaped' : 'barely paused at the saddle and rolled') + ' into a minimum. ' : '<b>Still parked at the saddle after ' + T + ' steps.</b> ') +
      (noisy ? 'Gradient noise kicks the ball off the ridge almost at once, which is one reason SGD rarely gets stuck at saddles.' :
        'The ball started ' + oY.textContent + ' away from the ridge line. Near the saddle the slope is almost zero, so that tiny offset grows only by about 10% per step. The closer the start to the ridge, the longer the plateau in the loss curve.');
  }
  G.on(sY, 'input', draw); G.on(cNoise, 'change', draw);
  return draw;
});
