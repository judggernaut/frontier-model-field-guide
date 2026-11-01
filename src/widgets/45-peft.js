/* Chapter 35: LoRA widgets */
G.widget('w-lo-calc', function (root) {
  var shapes = {
    '8b': { d: 4096, L: 32, ff: 14336, kv: 1024, V: 128256, tied: false },
    '70b': { d: 8192, L: 80, ff: 28672, kv: 1024, V: 128256, tied: false },
    '1b': { d: 2048, L: 16, ff: 8192, kv: 512, V: 128256, tied: true }
  };
  var sel = G.$(root, '#lo-model'), rs = G.$(root, '#lo-r'), qs = G.$(root, '#lo-q'), cv = G.$(root, 'canvas');
  var mods = G.$$(root, '[data-mods] button');
  sel.options[2].textContent = '1B (shaped like Llama 3.2 1B)';
  function dims(s) {
    return { q: [s.d, s.d], k: [s.kv, s.d], v: [s.kv, s.d], o: [s.d, s.d], gate: [s.ff, s.d], up: [s.ff, s.d], down: [s.d, s.ff] };
  }
  function total(s) {
    var D = dims(s), per = 0; Object.keys(D).forEach(function (k) { per += D[k][0] * D[k][1]; });
    return per * s.L + s.V * s.d * (s.tied ? 1 : 2);
  }
  function gb(bytes) { return bytes / 1e9; }
  function draw() {
    var P = G.pal(), s = shapes[sel.value], r = Math.pow(2, +rs.value), baseB = +qs.value;
    G.$(root, '#lo-r-o').textContent = r;
    var D = dims(s), tr = 0;
    mods.forEach(function (b) { if (b.getAttribute('aria-pressed') === 'true') { var m = D[b.dataset.m]; tr += r * (m[0] + m[1]) * s.L; } });
    var T = total(s);
    G.$(root, '[data-tot]').textContent = G.big(T);
    G.$(root, '[data-tr]').textContent = G.big(tr);
    G.$(root, '[data-sh]').textContent = G.fmt(tr / T * 100, tr / T < 0.001 ? 3 : 2) + '%';
    var fileMB = tr * 2 / 1e6;
    G.$(root, '[data-file]').textContent = fileMB >= 1000 ? G.fmt(fileMB / 1000, 2) + ' GB' : G.fmt(fileMB, fileMB < 10 ? 1 : 0) + ' MB';
    var bars = [
      { n: 'Full fine-tuning (Adam, mixed precision)', v: gb(16 * T), c: P.fp, on: false },
      { n: 'LoRA, bf16 base', v: gb(2 * T + 16 * tr), c: P.accent, on: baseB === 2 },
      { n: 'QLoRA, 4-bit base', v: gb(0.53 * T + 16 * tr), c: P.tp, on: baseB !== 2 }
    ];
    var c = G.canvas(cv, 190), ctx = c.ctx, pad = { l: 16, r: 18, t: 18, b: 34 };
    var lo = Math.log10(0.5), hi = Math.log10(3000);
    var X = function (v) { return pad.l + (Math.log10(Math.max(0.5, v)) - lo) / (hi - lo) * (c.w - pad.l - pad.r); };
    ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    [1, 10, 100, 1000].forEach(function (t) {
      ctx.globalAlpha = .7; ctx.beginPath(); ctx.moveTo(X(t), pad.t); ctx.lineTo(X(t), c.h - pad.b); ctx.stroke(); ctx.globalAlpha = 1;
      G.text(ctx, t >= 1000 ? '1 TB' : t + ' GB', X(t), c.h - pad.b + 12, P.faint, 'center', 11);
    });
    [[24, '24 GB card'], [80, '80 GB card']].forEach(function (g) {
      ctx.save(); ctx.strokeStyle = P.warn; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(X(g[0]), pad.t - 6); ctx.lineTo(X(g[0]), c.h - pad.b); ctx.stroke(); ctx.restore();
      G.text(ctx, g[1], X(g[0]) + 4, pad.t - 8, P.warn, 'left', 10);
    });
    var bh = 30, gap = 14;
    bars.forEach(function (b, i) {
      var y = pad.t + 6 + i * (bh + gap);
      ctx.globalAlpha = b.on || i === 0 ? 0.9 : 0.45; ctx.fillStyle = b.c;
      ctx.fillRect(X(0.5), y, X(b.v) - X(0.5), bh); ctx.globalAlpha = 1;
      var label = b.n + ': ' + (b.v >= 1000 ? G.fmt(b.v / 1000, 2) + ' TB' : G.fmt(b.v, b.v < 10 ? 1 : 0) + ' GB');
      var inside = X(b.v) - X(0.5) > 330;
      G.text(ctx, label, inside ? X(0.5) + 8 : X(b.v) + 6, y + bh / 2, inside ? P.surface : P.fg, 'left', 12);
    });
    var cur = bars[baseB === 2 ? 1 : 2];
    G.$(root, '[data-out]').textContent = 'Weights, gradients, and optimizer state only: about ' + G.fmt(cur.v, cur.v < 10 ? 1 : 0) + ' GB for this setup versus ' +
      G.fmt(bars[0].v / (bars[0].v >= 1000 ? 1000 : 1), bars[0].v >= 1000 ? 2 : 0) + (bars[0].v >= 1000 ? ' TB' : ' GB') + ' for full fine-tuning, ' + G.fmt(bars[0].v / cur.v, 0) +
      '× less. Doubling the rank doubles the trainable parameters but barely moves total memory, because the frozen base dominates. Adding the MLP projections usually improves quality more than raising the rank.';
  }
  mods.forEach(function (b) { b.addEventListener('click', function () { b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); draw(); }); });
  G.on([sel, rs, qs], 'input', draw); G.on([sel, qs], 'change', draw);
  return draw;
});

G.widget('w-lo-svd', function (root) {
  var N = 40, kind = 'update', rs = G.$(root, '#lo-sr'), cv = G.$(root, 'canvas'), kb = G.$$(root, '[data-kind] button');
  function make(k) {
    var r = G.rng(7), M = [], i, j;
    for (i = 0; i < N; i++) { M.push(new Array(N).fill(0)); }
    if (k === 'update') {
      var comps = [[5, 1.0, 0.7], [2.6, 2.3, 1.9], [1.3, 3.7, 3.1], [0.6, 5.2, 4.4]];
      comps.forEach(function (cp) {
        for (i = 0; i < N; i++) for (j = 0; j < N; j++)
          M[i][j] += cp[0] * Math.sin(cp[1] * i / N * Math.PI + 0.3) * Math.cos(cp[2] * j / N * Math.PI) / 4;
      });
      for (i = 0; i < N; i++) for (j = 0; j < N; j++) M[i][j] += 0.04 * G.gauss(r);
    } else if (k === 'image') {
      for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
        var dx = i - 19.5, dy = j - 19.5, dd = Math.sqrt(dx * dx + dy * dy);
        var v = (dd > 9 && dd < 15) ? 1 : 0;
        if (j > 5 && j < 10 && i > 4 && i < 36) v = 1;
        if (i > 30 && i < 35 && j > 18) v = -0.8;
        M[i][j] = v;
      }
    } else {
      for (i = 0; i < N; i++) for (j = 0; j < N; j++) M[i][j] = G.gauss(r) * 0.5;
    }
    return M;
  }
  function svd(M) {
    // eigen-decomposition of M^T M by cyclic Jacobi, then U = M V / sigma
    var n = N, A = [], V = [], i, j, k;
    for (i = 0; i < n; i++) { A.push(new Array(n).fill(0)); V.push(new Array(n).fill(0)); V[i][i] = 1; }
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) { var s = 0; for (k = 0; k < n; k++) s += M[k][i] * M[k][j]; A[i][j] = s; }
    for (var sweep = 0; sweep < 12; sweep++) {
      var off = 0;
      for (var p = 0; p < n - 1; p++) for (var q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-12) continue;
        off += A[p][q] * A[p][q];
        var th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        var t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        var c = 1 / Math.sqrt(t * t + 1), sn = t * c;
        for (k = 0; k < n; k++) { var akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - sn * akq; A[k][q] = sn * akp + c * akq; }
        for (k = 0; k < n; k++) { var apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - sn * aqk; A[q][k] = sn * apk + c * aqk; }
        for (k = 0; k < n; k++) { var vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - sn * vkq; V[k][q] = sn * vkp + c * vkq; }
      }
      if (off < 1e-18) break;
    }
    var idx = []; for (i = 0; i < n; i++) idx.push(i);
    idx.sort(function (a, b) { return A[b][b] - A[a][a]; });
    var sig = idx.map(function (ii) { return Math.sqrt(Math.max(0, A[ii][ii])); });
    var Vs = idx.map(function (ii) { var v = []; for (k = 0; k < n; k++) v.push(V[k][ii]); return v; });
    var Us = Vs.map(function (v, m) { var u = []; for (k = 0; k < n; k++) { var s2 = 0; for (j = 0; j < n; j++) s2 += M[k][j] * v[j]; u.push(sig[m] > 1e-9 ? s2 / sig[m] : 0); } return u; });
    return { s: sig, U: Us, V: Vs };
  }
  var cache = {};
  function get(k) { if (!cache[k]) { var M = make(k); cache[k] = { M: M, d: svd(M) }; } return cache[k]; }
  function heat(ctx, M, x0, y0, size, mx, P) {
    var cs = size / N;
    ctx.fillStyle = P.surface; ctx.fillRect(x0, y0, size, size);
    for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
      var v = M[i][j] / mx; if (Math.abs(v) < 0.02) continue;
      ctx.globalAlpha = Math.min(1, Math.abs(v)); ctx.fillStyle = v > 0 ? P.accent : P.fp;
      ctx.fillRect(x0 + j * cs, y0 + i * cs, Math.ceil(cs), Math.ceil(cs));
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = P.line; ctx.strokeRect(x0 + .5, y0 + .5, size - 1, size - 1);
  }
  function draw() {
    var P = G.pal(), r = +rs.value; G.$(root, '#lo-sr-o').textContent = r;
    var g = get(kind), M = g.M, d = g.d;
    var R = [], i, j, m;
    for (i = 0; i < N; i++) { R.push(new Array(N).fill(0)); }
    for (m = 0; m < r; m++) for (i = 0; i < N; i++) { var us = d.U[m][i] * d.s[m]; for (j = 0; j < N; j++) R[i][j] += us * d.V[m][j]; }
    var mx = 0; for (i = 0; i < N; i++) for (j = 0; j < N; j++) mx = Math.max(mx, Math.abs(M[i][j]));
    var c = G.canvas(cv, 0), w = c.w;
    var size = Math.min(200, (w - 40) / 2), H = size + 30 + 150;
    c = G.canvas(cv, H); var ctx = c.ctx;
    var x1 = (w - (2 * size + 30)) / 2, x2 = x1 + size + 30;
    G.text(ctx, 'Original', x1, 10, P.muted, 'left', 12); G.text(ctx, 'Rank ' + r + ' reconstruction', x2, 10, P.muted, 'left', 12);
    heat(ctx, M, x1, 20, size, mx, P); heat(ctx, R, x2, 20, size, mx, P);
    var tot = 0, cum = 0; d.s.forEach(function (s) { tot += s * s; });
    var top = size + 50, pad = { l: 44, r: 12, t: top, b: 30 };
    var ax = G.axes(ctx, w, H, pad, { x: [0.5, N + 0.5], y: [0, 1], xt: [1, 10, 20, 30, 40], yt: [0, 0.5, 1], yf: function (v) { return G.pct(v); }, xl: 'singular direction (largest first)' });
    var bw = (w - pad.l - pad.r) / N * 0.7, cumPts = [];
    d.s.forEach(function (s, k) {
      var sh = s * s / tot; cum += sh;
      ctx.globalAlpha = k < r ? 0.9 : 0.3; ctx.fillStyle = P.accent;
      ctx.fillRect(ax.X(k + 1) - bw / 2, ax.Y(sh), bw, ax.Y(0) - ax.Y(sh)); ctx.globalAlpha = 1;
      cumPts.push([ax.X(k + 1), ax.Y(cum)]);
    });
    G.line(ctx, cumPts, P.tp, 2);
    var en = 0; for (m = 0; m < r; m++) en += d.s[m] * d.s[m] / tot;
    G.text(ctx, 'cumulative', cumPts[Math.min(N - 1, 2)][0] + 8, cumPts[Math.min(N - 1, 2)][1] + 12, P.tp, 'left', 11);
    G.$(root, '[data-en]').textContent = G.pct(en, 1);
    G.$(root, '[data-np]').textContent = (r * (N + N)).toLocaleString();
    G.$(root, '[data-ratio]').textContent = G.pct(r * 2 * N / (N * N));
    var msg = kind === 'update' ? 'Like a real fine-tuning update, this matrix has a few strong directions and a little noise. Rank 4 captures nearly all of it.'
      : kind === 'image' ? 'Sharp edges spread energy over more directions, so this needs a higher rank than the smooth update, but still far fewer than 40.'
      : 'Random noise has no structure: every direction carries a similar share, so a low-rank copy captures only a small fraction. LoRA would struggle with an update like this.';
    G.$(root, '[data-out]').textContent = msg + ' Storing a rank-' + r + ' copy takes r × (rows + columns) = ' + (r * 2 * N) + ' numbers instead of 1,600.';
  }
  kb.forEach(function (b) { b.addEventListener('click', function () { kind = b.dataset.k; kb.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); draw(); }); });
  G.on(rs, 'input', draw);
  return draw;
});
