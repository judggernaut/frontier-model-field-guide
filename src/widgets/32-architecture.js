G.widget('w-ar-grad', function (root) {
  var sL = G.$(root, '#ar-L'), sG = G.$(root, '#ar-g'), oL = G.$(root, '#ar-L-o'), oG = G.$(root, '#ar-g-o');
  var bRes = G.$(root, '[data-res]'), bNorm = G.$(root, '[data-norm]');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  var N = 48, LMAX = 200;
  // One fixed set of random weights (unit scale) and a fixed input and output direction.
  // The gain slider multiplies these, so every redraw is the same network, just rescaled.
  var r = G.rng(7), base = [], x0 = [], u = [], i, j, l;
  for (l = 0; l < LMAX; l++) { var W = new Float64Array(N * N); for (i = 0; i < N * N; i++) W[i] = G.gauss(r) * Math.sqrt(2 / N); base.push(W); }
  for (i = 0; i < N; i++) { x0.push(G.gauss(r)); u.push(G.gauss(r)); }
  var res = false, norm = false;

  function norm2(v) { var s = 0; for (var q = 0; q < v.length; q++) s += v[q] * v[q]; return Math.sqrt(s); }

  // Forward then backward through L layers of a real 48-wide ReLU network.
  // Returns log10 of the gradient size at each layer, relative to the output layer, and the output signal size.
  function run(L, g, useRes, useNorm) {
    var h = x0.slice(), cache = [];
    for (l = 0; l < L; l++) {
      var W = base[l], x = h, inp = x, sd = 1, xh = null;
      if (useNorm) {
        var mu = G.mean(x), v = 0; for (i = 0; i < N; i++) v += (x[i] - mu) * (x[i] - mu);
        sd = Math.sqrt(v / N) + 1e-9; xh = new Array(N); for (i = 0; i < N; i++) xh[i] = (x[i] - mu) / sd; inp = xh;
      }
      var z = new Array(N), a = new Array(N);
      for (i = 0; i < N; i++) { var s = 0, off = i * N; for (j = 0; j < N; j++) s += W[off + j] * inp[j]; z[i] = g * s; a[i] = z[i] > 0 ? z[i] : 0; }
      cache.push({ z: z, xh: xh, sd: sd });
      var nh = new Array(N); for (i = 0; i < N; i++) nh[i] = useRes ? x[i] + a[i] : a[i];
      h = nh;
    }
    var outSize = norm2(h) / Math.sqrt(N);
    var d = u.slice(), logs = new Array(L + 1), ref = norm2(d), lg = 0;
    logs[L] = 0;
    for (l = L - 1; l >= 0; l--) {
      var c = cache[l], Wb = base[l], dz = new Array(N), dinp = new Array(N);
      for (i = 0; i < N; i++) dz[i] = c.z[i] > 0 ? d[i] * g : 0;
      for (j = 0; j < N; j++) { var t = 0; for (i = 0; i < N; i++) t += Wb[i * N + j] * dz[i]; dinp[j] = t; }
      var dx = dinp;
      if (useNorm) {
        var m1 = G.mean(dinp), m2 = 0; for (i = 0; i < N; i++) m2 += dinp[i] * c.xh[i]; m2 /= N;
        dx = new Array(N); for (i = 0; i < N; i++) dx[i] = (dinp[i] - m1 - c.xh[i] * m2) / c.sd;
      }
      var nd = new Array(N); for (i = 0; i < N; i++) nd[i] = useRes ? d[i] + dx[i] : dx[i];
      // renormalise as we go so 200 layers of explosion never overflow; keep the log of the scale
      var sz = norm2(nd) || 1e-300; lg += Math.log10(sz / norm2(d));
      for (i = 0; i < N; i++) nd[i] /= sz;
      d = nd; logs[l] = lg;
    }
    void ref;
    return { logs: logs, out: outSize };
  }

  var CFG = [
    { res: false, norm: false, name: 'plain', col: 'fp' },
    { res: false, norm: true, name: 'plain + normalisation', col: 'fn' },
    { res: true, norm: false, name: 'residual', col: 'eli5' },
    { res: true, norm: true, name: 'residual + normalisation', col: 'good' }
  ];

  function tickLabel(t) { return t === 0 ? '1' : '1e' + t; }

  function draw() {
    var P = G.pal(), L = +sL.value, g = +sG.value;
    oL.textContent = L; oG.textContent = G.fmt(g, 2);
    bRes.setAttribute('aria-pressed', res ? 'true' : 'false'); bNorm.setAttribute('aria-pressed', norm ? 'true' : 'false');
    var runs = CFG.map(function (c) { return run(L, g, c.res, c.norm); });
    var sel = CFG.findIndex(function (c) { return c.res === res && c.norm === norm; }), cur = runs[sel];
    var mx = 0; cur.logs.forEach(function (v) { mx = Math.max(mx, Math.abs(v)); });
    var m = Math.min(60, Math.max(4, mx)), step = m <= 8 ? 2 : m <= 16 ? 4 : m <= 32 ? 8 : 20, span = Math.ceil(m / step) * step;
    var yt = []; for (var t = -span; t <= span; t += step) yt.push(t);
    var xt = L <= 10 ? [0, L] : [0, Math.round(L / 4), Math.round(L / 2), Math.round(3 * L / 4), L];
    var c = G.canvas(cv, 270), ctx = c.ctx, pad = { l: 52, r: 14, t: 26, b: 34 };
    var ax = G.axes(ctx, c.w, c.h, pad, { x: [0, Math.max(L, 1)], y: [-span, span], xt: xt, yt: yt, yf: tickLabel, xl: 'layer (0 = first layer, right edge = output)' });
    G.text(ctx, '↑ gradient size relative to the output layer (log scale)', pad.l, 9, P.muted, 'left', 11.5);
    // healthy band: within a factor of 100 of the output layer's gradient
    ctx.fillStyle = P.good; ctx.globalAlpha = 0.08;
    ctx.fillRect(pad.l, ax.Y(2), c.w - pad.l - pad.r, ax.Y(-2) - ax.Y(2)); ctx.globalAlpha = 1;
    G.text(ctx, 'healthy: within 100× of the output', pad.l + 6, ax.Y(-2) - 9, P.good, 'left', 11);
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, c.w - pad.l - pad.r, c.h - pad.t - pad.b); ctx.clip();
    runs.forEach(function (rr, q) {
      if (q === sel) return;
      G.line(ctx, rr.logs.map(function (v, li) { return [ax.X(li), ax.Y(v)]; }), P[CFG[q].col], 1.2, [4, 4]);
    });
    G.line(ctx, cur.logs.map(function (v, li) { return [ax.X(li), ax.Y(v)]; }), P[CFG[sel].col], 3);
    ctx.restore();
    var first = cur.logs[0], per = L > 0 ? Math.pow(10, first / L) : 1;
    k('first').textContent = G.sci(Math.pow(10, first)).replace(/e0$/, '');
    k('per').textContent = '×' + G.fmt(per, 3);
    k('fwd').textContent = G.sci(cur.out).replace(/e0$/, '');
    var healthy = Math.abs(first) <= 2, verdict = healthy ? 'trainable' : first < 0 ? 'vanishing' : 'exploding';
    k('ver').textContent = verdict;
    k('ver').style.color = healthy ? 'var(--good)' : 'var(--fp)';
    var msg = '<b>' + CFG[sel].name.charAt(0).toUpperCase() + CFG[sel].name.slice(1) + '</b>, ' + L + ' layers, gain ' + G.fmt(g, 2) + '. ';
    if (!res && !norm) {
      msg += 'Each layer multiplies the gradient by about ×' + G.fmt(per, 3) + ', so the first layer gets ×' + G.fmt(per, 3) + '<sup>' + L + '</sup> ≈ ' + G.sci(Math.pow(10, first)) + ' of the output layer\'s signal. ' +
        (healthy ? 'Near gain 1.00 the product stays close to 1: careful initialisation keeps a plain net trainable at this depth. Push the depth up and small drifts compound.' : first < 0 ? 'The early layers barely learn. Raise the gain above 1 and the same product explodes instead.' : 'Updates to the early layers blow up. Lower the gain below 1 and the same product vanishes instead.');
    } else if (!res && norm) {
      msg += 'Normalisation pins the forward signal at a fixed size (output ≈ ' + G.fmt(cur.out, 1) + ' whatever the gain), but in this deep plain stack the backward gradient still drifts by ×' + G.fmt(per, 3) + ' per layer. Fixing the forward scale is not the same as giving the gradient a clean path.';
    } else if (res && !norm) {
      msg += 'The identity path stops the gradient vanishing, but every unscaled branch adds on top of it, so both the signal (output ≈ ' + G.sci(cur.out) + ') and the gradient grow layer after layer. This is why residual nets also need normalisation or a scaled-down branch.';
    } else {
      msg += 'The gradient reaches layer 0 at ' + G.sci(Math.pow(10, first)) + ' times its output size. It grows only slowly with depth and hardly reacts to the gain: the identity path carries it back, and normalisation keeps each branch\'s contribution a fixed size. This is the pre-norm layout modern transformers use.';
    }
    out.innerHTML = msg;
  }
  G.on([sL, sG], 'input', draw);
  G.on(bRes, 'click', function () { res = !res; draw(); });
  G.on(bNorm, 'click', function () { norm = !norm; draw(); });
  return draw;
});
