G.widget('w-op-gd', function (root) {
  var lr = G.$(root, '#op-lr'), beta = G.$(root, '#op-beta'), opt = G.$(root, '#op-opt');
  var cvS = G.$(root, 'canvas[data-cv="surf"]'), cvL = G.$(root, 'canvas[data-cv="loss"]'), out = G.$(root, '[data-out]');
  var A = 1, B = 10, X0 = -4.2, Y0 = 1.6, STEPS = 60;
  var PRESETS = { small: [0.01, 0, 'sgd'], good: [0.15, 0, 'sgd'], large: [0.205, 0, 'sgd'], mom: [0.03, 0.85, 'sgd'], adam: [0.25, 0, 'adam'] };
  function loss(x, y) { return 0.5 * (A * x * x + B * y * y); }
  function run(eta, b, kind) {
    var x = X0, y = Y0, vx = 0, vy = 0, mx = 0, my = 0, sx = 0, sy = 0, pts = [[x, y]], ls = [loss(x, y)];
    for (var t = 1; t <= STEPS; t++) {
      var gx = A * x, gy = B * y;
      if (kind === 'adam') {
        mx = 0.9 * mx + 0.1 * gx; my = 0.9 * my + 0.1 * gy; sx = 0.999 * sx + 0.001 * gx * gx; sy = 0.999 * sy + 0.001 * gy * gy;
        var c1 = 1 - Math.pow(0.9, t), c2 = 1 - Math.pow(0.999, t);
        x -= eta * (mx / c1) / (Math.sqrt(sx / c2) + 1e-8); y -= eta * (my / c1) / (Math.sqrt(sy / c2) + 1e-8);
      } else { vx = b * vx + gx; vy = b * vy + gy; x -= eta * vx; y -= eta * vy; }
      if (!isFinite(x) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) { ls.push(Infinity); break; }
      pts.push([x, y]); ls.push(loss(x, y));
    }
    return { pts: pts, ls: ls };
  }
  function draw() {
    var P = G.pal(), eta = parseFloat(lr.value), b = parseFloat(beta.value), kind = opt.value;
    G.$(root, '#op-lr-o').textContent = G.fmt(eta, 3); G.$(root, '#op-beta-o').textContent = G.fmt(b, 2);
    beta.disabled = kind === 'adam';
    var r = run(eta, b, kind);
    var c = G.canvas(cvS, 250), ctx = c.ctx, pad = { l: 34, r: 12, t: 10, b: 28 };
    var s = G.axes(ctx, c.w, c.h, pad, { x: [-5, 5], y: [-2.4, 2.4], xt: [-4, -2, 0, 2, 4], yt: [-2, 0, 2], xl: 'shallow direction (curvature 1)', yl: 'steep (10)' });
    [0.05, 0.3, 1, 2.5, 5, 9].forEach(function (L) {
      var pts = []; for (var i = 0; i <= 80; i++) { var a = i / 80 * Math.PI * 2; pts.push([s.X(Math.sqrt(2 * L / A) * Math.cos(a)), s.Y(Math.sqrt(2 * L / B) * Math.sin(a))]); }
      G.line(ctx, pts, P.line, 1);
    });
    G.dot(ctx, s.X(0), s.Y(0), 4, P.tp);
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, c.w - pad.l - pad.r, c.h - pad.t - pad.b); ctx.clip();
    G.line(ctx, r.pts.map(function (p) { return [s.X(p[0]), s.Y(p[1])]; }), P.accent, 1.8);
    r.pts.forEach(function (p, i) { if (i % 3 === 0) G.dot(ctx, s.X(p[0]), s.Y(p[1]), 2.5, P.accent); });
    ctx.restore();
    G.dot(ctx, s.X(X0), s.Y(Y0), 5, P.fp);
    G.text(ctx, 'start', s.X(X0) + 8, s.Y(Y0) - 8, P.fp, 'left', 11);
    // loss curve
    var c2 = G.canvas(cvL, 150), ctx2 = c2.ctx, pad2 = { l: 44, r: 12, t: 8, b: 30 };
    var s2 = G.axes(ctx2, c2.w, c2.h, pad2, { x: [0, STEPS], y: [-8, 1.5], xt: [0, 20, 40, 60], yt: [-8, -6, -4, -2, 0], yf: function (v) { return '1e' + v; }, xl: 'step', yl: 'loss (log)' });
    var lp = []; r.ls.forEach(function (v, i) { if (isFinite(v)) lp.push([s2.X(i), s2.Y(Math.max(-8, Math.min(1.5, Math.log10(Math.max(v, 1e-9)))))]); });
    G.line(ctx2, lp, P.accent, 2);
    var last = r.ls[r.ls.length - 1], diverged = !isFinite(last) || last > r.ls[0];
    var msg = diverged ? '<b>Diverged.</b> The step is larger than 2 divided by the steepest curvature (0.2 here), so each step overshoots further than the last.' :
      last > 0.5 ? '<b>Too slow.</b> Safe in the steep direction, but the shallow direction barely moves. Loss after ' + STEPS + ' steps: ' + G.fmt(last, 3) + '.' :
      '<b>Converging.</b> Loss after ' + STEPS + ' steps: ' + G.sci(last) + '.';
    if (kind === 'adam') msg += ' Adam rescales each direction by its own gradient size, so both directions move at a similar pace.';
    else if (b > 0) msg += ' Momentum builds speed along the consistent shallow direction and damps the zig-zag across the valley.';
    out.innerHTML = msg;
  }
  G.$$(root, '[data-preset]').forEach(function (btn) {
    btn.addEventListener('click', function () { var p = PRESETS[btn.dataset.preset]; lr.value = p[0]; beta.value = p[1]; opt.value = p[2]; draw(); });
  });
  G.on([lr, beta], 'input', draw); G.on(opt, 'change', draw);
  return draw;
});

G.widget('w-op-mem', function (root) {
  var n = G.$(root, '#op-n'), o = G.$(root, '#op-o'), z = G.$(root, '#op-z'), g = G.$(root, '#op-g'), a = G.$(root, '#op-a'), cap = G.$(root, '#op-cap');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  function draw() {
    var P = G.pal(), params = Math.pow(10, parseFloat(n.value)) * 1e9, K = parseInt(o.value, 10), st = parseInt(z.value, 10);
    var gpus = Math.pow(2, parseInt(g.value, 10)), act = parseFloat(a.value), C = parseFloat(cap.value);
    G.$(root, '#op-n-o').textContent = G.big(params); G.$(root, '#op-g-o').textContent = gpus; G.$(root, '#op-a-o').textContent = act;
    var wB = K === 8 ? 2 : 2, gB = 2, optB = K - 4;
    var w = wB * params / 1e9, gr = gB * params / 1e9, op = optB * params / 1e9;
    if (st >= 1) op /= gpus; if (st >= 2) gr /= gpus; if (st >= 3) w /= gpus;
    var total = w + gr + op + act;
    var parts = [['weights', w, P.accent], ['gradients', gr, P.eli5], ['optimiser states', op, P.lead], ['activations', act, P.tn]];
    var c = G.canvas(cv, 120), ctx = c.ctx, pad = { l: 12, r: 12, t: 26, b: 26 };
    var xmax = Math.max(C * 1.25, total * 1.05);
    var X = function (v) { return pad.l + v / xmax * (c.w - pad.l - pad.r); };
    var x = 0, y = pad.t, h = c.h - pad.t - pad.b;
    parts.forEach(function (p) { ctx.fillStyle = p[2]; ctx.fillRect(X(x), y, X(x + p[1]) - X(x), h); x += p[1]; });
    ctx.strokeStyle = P.fp; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(X(C), 8); ctx.lineTo(X(C), c.h - 8); ctx.stroke(); ctx.setLineDash([]);
    G.text(ctx, C + ' GB per GPU', X(C) + 6, 14, P.fp, 'left', 11);
    var lx = pad.l; parts.forEach(function (p) { ctx.fillStyle = p[2]; ctx.fillRect(lx, c.h - 14, 10, 10); G.text(ctx, p[0] + ' ' + G.fmt(p[1], 1), lx + 14, c.h - 9, P.muted, 'left', 11); lx += ctx.measureText(p[0] + ' ' + G.fmt(p[1], 1)).width + 34; });
    var cluster = (4 + optB) * params / 1e12;
    out.innerHTML = 'Per GPU: <b>' + G.fmt(total, 1) + ' GB</b> ' + (total <= C ? '<span style="color:var(--tp)">fits</span>' : '<span style="color:var(--fp)">does not fit</span>') +
      '. Model states across the whole group: ' + G.fmt(cluster, 2) + ' TB (' + K + ' bytes per parameter). ' +
      (st < 3 && total > C ? 'Raise the ZeRO stage or add GPUs to shard more of it. ' : '') +
      (st === 3 ? 'At stage 3 every piece of model state is split ' + gpus + ' ways; the cost is extra communication to gather weights for each layer.' : '');
  }
  G.on([n, g, a], 'input', draw); G.on([o, z, cap], 'change', draw);
  return draw;
});
