/* GRPO chapter widgets: group advantages, and pass@k under RL sharpening. */
G.widget('w-gr-adv', function (root) {
  var sg = G.$(root, '#gr-g'), sk = G.$(root, '#gr-k'), og = G.$(root, '#gr-g-o'), ok = G.$(root, '#gr-k-o');
  var cvB = G.$(root, 'canvas[data-cv="bars"]'), cvC = G.$(root, 'canvas[data-cv="curve"]'), out = G.$(root, '[data-out]');
  var btns = G.$$(root, 'button[data-m]'), mode = 'grpo';
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.dataset.m;
      btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      draw();
    });
  });
  function advs(r) {
    var g = r.length, mu = G.mean(r), sd = Math.sqrt(G.mean(r.map(function (v) { return (v - mu) * (v - mu); })));
    if (mode === 'dr') return r.map(function (v) { return v - mu; });
    if (mode === 'rloo') { var s = G.sum(r); return r.map(function (v) { return v - (s - v) / (g - 1); }); }
    return r.map(function (v) { return sd > 1e-9 ? (v - mu) / sd : 0; });
  }
  function draw() {
    var g = +sg.value; sk.max = g; if (+sk.value > g) sk.value = g;
    var k = +sk.value; og.textContent = g; ok.textContent = k;
    var r = []; for (var i = 0; i < g; i++) r.push(i < k ? 1 : 0);
    var a = advs(r), P = G.pal();
    // bars
    var c = G.canvas(cvB, 200), ctx = c.ctx, pad = { l: 46, r: 12, t: 14, b: 30 };
    var lim = Math.max(1, Math.ceil(Math.max.apply(null, a.map(Math.abs)) * 2) / 2);
    var s = G.axes(ctx, c.w, c.h, pad, { x: [0, g], y: [-lim, lim], yt: [-lim, 0, lim], yf: function (t) { return G.fmt(t, 1); }, yl: 'advantage' });
    ctx.strokeStyle = P.fg; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.l, s.Y(0)); ctx.lineTo(c.w - pad.r, s.Y(0)); ctx.stroke();
    var bw = (c.w - pad.l - pad.r) / g;
    for (i = 0; i < g; i++) {
      var x0 = s.X(i) + bw * 0.15, w = bw * 0.7, y0 = s.Y(0), y1 = s.Y(a[i]);
      ctx.fillStyle = r[i] ? P.tp : P.fp; ctx.globalAlpha = 0.85;
      ctx.fillRect(x0, Math.min(y0, y1), w, Math.max(1, Math.abs(y1 - y0))); ctx.globalAlpha = 1;
      G.text(ctx, r[i] ? '✓' : '✗', x0 + w / 2, c.h - pad.b + 14, r[i] ? P.tp : P.fp, 'center', 12);
    }
    if (k === 0 || k === g) G.text(ctx, 'Every response got the same reward: zero advantage, no learning signal', (pad.l + c.w - pad.r) / 2, pad.t + 12, P.warn, 'center', 13);
    // weight-per-prompt curve
    var c2 = G.canvas(cvC, 190), x2 = c2.ctx, pad2 = { l: 46, r: 12, t: 16, b: 34 };
    var s2 = G.axes(x2, c2.w, c2.h, pad2, { x: [0, 1], y: [0, 1.05], xt: [0, 0.25, 0.5, 0.75, 1], yt: [0, 0.5, 1], xf: function (t) { return G.pct(t); }, xl: 'pass rate p within the group', yl: 'weight' });
    var A = [], B = [];
    for (var j = 0; j <= 100; j++) { var p = j / 100; A.push([s2.X(p), s2.Y(2 * Math.sqrt(p * (1 - p)))]); B.push([s2.X(p), s2.Y(4 * p * (1 - p))]); }
    G.line(x2, A, P.accent, 2); G.line(x2, B, P.tp, 2, [6, 4]);
    var pk = k / g; G.dot(x2, s2.X(pk), s2.Y(mode === 'grpo' ? 2 * Math.sqrt(pk * (1 - pk)) : 4 * pk * (1 - pk)), 5, P.fg, P.surface);
    G.text(x2, 'with std scaling (GRPO)', s2.X(0.1), s2.Y(0.84), P.accent, 'left', 11);
    G.text(x2, 'centre only (Dr. GRPO), rescaled', s2.X(0.97), s2.Y(0.12), P.tp, 'right', 11);
    var tot = G.sum(a.map(Math.abs));
    out.innerHTML = 'Correct responses get <b>' + (k > 0 ? G.fmt(a[0], 2) : '—') + '</b>, incorrect get <b>' + (k < g ? G.fmt(a[g - 1], 2) : '—') +
      '</b>. Total absolute advantage from this prompt: <b>' + G.fmt(tot, 2) + '</b>. ' +
      (mode === 'grpo' ? 'Dividing by the std makes rare successes huge: one right answer out of ' + g + ' gets ' + G.fmt(Math.sqrt((g - 1)), 2) + '.' :
       mode === 'dr' ? 'Without std scaling, the weight a prompt gets falls off at the extremes, so near-always and near-never prompts count less.' :
       'RLOO equals the centred version times G/(G−1); it removes the bias from including each response in its own baseline.') +
      ' The lower chart shows how much total weight a prompt gets as its pass rate varies (each curve scaled to peak at 1).';
  }
  G.on([sg, sk], 'input', draw);
  return draw;
});

G.widget('w-gr-passk', function (root) {
  var ss = G.$(root, '#gr-s'), sc = G.$(root, '#gr-c'), os = G.$(root, '#gr-s-o'), oc = G.$(root, '#gr-c-o');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var r = G.rng(7), base = [];
  for (var i = 0; i < 400; i++) base.push(-0.8 + 2.2 * G.gauss(r)); // log-odds of solving, base model
  var ks = []; for (var e = 0; e <= 8; e += 0.25) ks.push(Math.pow(2, e));
  function passk(z, k) { var s = 0; for (var i = 0; i < z.length; i++) { var p = G.sigmoid(z[i]); s += 1 - Math.pow(1 - p, k); } return s / z.length; }
  function draw() {
    var s = +ss.value, c = +sc.value; os.textContent = G.fmt(s, 1); oc.textContent = G.fmt(c, 1);
    var rl = base.map(function (z) { return c + s * (z - c); });
    var P = G.pal(), cc = G.canvas(cv, 250), ctx = cc.ctx, pad = { l: 46, r: 14, t: 14, b: 36 };
    var ax = G.axes(ctx, cc.w, cc.h, pad, { x: [0, 8], y: [0, 1], xt: [0, 1, 2, 3, 4, 5, 6, 7, 8], xf: function (t) { return String(Math.pow(2, t)); }, yt: [0, 0.25, 0.5, 0.75, 1], yf: function (t) { return G.pct(t); }, xl: 'k (samples per problem, log scale)', yl: 'pass@k' });
    var A = [], B = [], cross = null, prev = null;
    ks.forEach(function (k) {
      var a = passk(base, k), b = passk(rl, k), x = Math.log2(k);
      A.push([ax.X(x), ax.Y(a)]); B.push([ax.X(x), ax.Y(b)]);
      var d = b - a; if (prev !== null && prev > 0 && d <= 0 && cross === null) cross = k; prev = d;
    });
    G.line(ctx, A, P.tn, 2, [6, 4]); G.line(ctx, B, P.accent, 2.5);
    var b1 = passk(base, 1), r1 = passk(rl, 1), b256 = passk(base, 256), r256 = passk(rl, 256);
    G.$(root, '[data-p1]').textContent = G.pct(b1) + ' → ' + G.pct(r1);
    G.$(root, '[data-p256]').textContent = G.pct(b256) + ' → ' + G.pct(r256);
    G.$(root, '[data-x]').textContent = cross ? String(Math.round(cross)) : (r256 >= b256 ? 'no cross' : '< 1');
    if (cross) { ctx.save(); ctx.strokeStyle = P.warn; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(ax.X(Math.log2(cross)), pad.t); ctx.lineTo(ax.X(Math.log2(cross)), cc.h - pad.b); ctx.stroke(); ctx.restore(); }
    var lost = 0; for (var i = 0; i < base.length; i++) { if (G.sigmoid(base[i]) > 0.01 && G.sigmoid(rl[i]) < 0.001) lost++; }
    out.innerHTML = 'RL ' + (r1 > b1 ? 'raises' : 'lowers') + ' pass@1 by <b>' + G.fmt(Math.abs(r1 - b1) * 100, 1) + ' points</b> and ' + (r256 >= b256 ? 'raises' : 'lowers') + ' pass@256 by <b>' + G.fmt(Math.abs(r256 - b256) * 100, 1) + ' points</b>. ' +
      '<b>' + lost + '</b> of 400 problems the base model solved at least 1% of the time are now effectively never solved. ' +
      (s <= 1.001 ? 'At strength 1 there is no sharpening, so the curves coincide.' : 'Evaluating only at k = 1 would report a clean win and miss that loss of coverage.') + ' Illustrative simulation.';
  }
  G.on([ss, sc], 'input', draw);
  return draw;
});
