G.widget('w-fm-mp', function (root) {
  var sK = G.$(root, '#fm-k'), oK = G.$(root, '#fm-k-o');
  var bOne = G.$(root, '[data-mode=one]'), bTwo = G.$(root, '[data-mode=two]');
  var bNext = G.$(root, '[data-next]'), bReset = G.$(root, '[data-reset]');
  var svg = G.$(root, 'svg'), cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  // Two tight groups joined by one bridge (C–D). Distances from A: 0,1,1,2,3,4,4,5.
  var NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  var POS = [[70, 70], [70, 190], [170, 130], [280, 130], [380, 130], [480, 70], [480, 190], [580, 130]];
  var EDGES = [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6], [5, 6], [5, 7], [6, 7]];
  var GROUP = [0, 0, 0, 0, 1, 1, 1, 1], KMAX = 60, n = 8;
  var nb = []; for (var i = 0; i < n; i++) nb.push([]);
  EDGES.forEach(function (e) { nb[e[0]].push(e[1]); nb[e[1]].push(e[0]); });
  // hop distance from A by breadth-first search
  var hop = [0, -1, -1, -1, -1, -1, -1, -1], q = [0];
  while (q.length) { var v = q.shift(); nb[v].forEach(function (u) { if (hop[u] < 0) { hop[u] = hop[v] + 1; q.push(u); } }); }
  var mode = 'one';

  // One round: each node's new value is the mean of itself and its neighbours.
  function step(h) { return h.map(function (hv, v) { var s = hv; nb[v].forEach(function (u) { s += h[u]; }); return s / (1 + nb[v].length); }); }
  function history() {
    var h = mode === 'one' ? [1, 0, 0, 0, 0, 0, 0, 0] : GROUP.map(function (g) { return g ? -1 : 1; }), hs = [h];
    for (var t = 0; t < KMAX; t++) { h = step(h); hs.push(h); }
    return hs;
  }

  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var a in attrs) e.setAttribute(a, attrs[a]); parent.appendChild(e); return e; }

  function draw() {
    var P = G.pal(), K = +sK.value, hs = history(), h = hs[K];
    oK.textContent = K;
    bOne.setAttribute('aria-pressed', mode === 'one'); bTwo.setAttribute('aria-pressed', mode === 'two');
    // --- graph picture ---
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    EDGES.forEach(function (e) {
      el('line', { x1: POS[e[0]][0], y1: POS[e[0]][1], x2: POS[e[1]][0], y2: POS[e[1]][1], stroke: 'var(--line-strong)', 'stroke-width': 2 }, svg);
    });
    var mx = 0; h.forEach(function (x) { mx = Math.max(mx, Math.abs(x)); });
    h.forEach(function (x, v) {
      var cx = POS[v][0], cy = POS[v][1], reached = Math.abs(x) > 1e-12;
      var col = mode === 'one' ? 'var(--accent)' : (x >= 0 ? 'var(--accent)' : 'var(--fp)');
      var op = mode === 'one' ? (reached ? 0.15 + 0.85 * Math.sqrt(Math.abs(x)) : 0) : Math.min(1, Math.abs(x));
      el('circle', { cx: cx, cy: cy, r: 24, fill: 'var(--surface)', stroke: reached || mode === 'two' ? col : 'var(--line-strong)', 'stroke-width': 2 }, svg);
      el('circle', { cx: cx, cy: cy, r: 24, fill: col, opacity: G.fmt(op * 0.85, 3) }, svg);
      var t = el('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: op > 0.55 ? 'var(--surface)' : 'var(--fg)' }, svg);
      t.textContent = G.fmt(x, 2);
      var lbl = el('text', { x: cx, y: cy - 32, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--fg)' }, svg); lbl.textContent = NAMES[v];
      if (mode === 'one') {
        var hl = el('text', { x: cx, y: cy + 42, 'text-anchor': 'middle', 'font-size': 12, fill: hop[v] <= K ? 'var(--accent)' : 'var(--muted)' }, svg);
        hl.textContent = hop[v] === 0 ? 'source' : hop[v] + (hop[v] === 1 ? ' hop' : ' hops');
      }
    });
    // --- value of every node across rounds ---
    var c = G.canvas(cv, 210), ctx = c.ctx, pad = { l: 44, r: 14, t: 22, b: 32 };
    var y0 = mode === 'one' ? 0 : -1, y1 = 1;
    var ax = G.axes(ctx, c.w, c.h, pad, { x: [0, KMAX], y: [y0, y1], xt: [0, 10, 20, 30, 40, 50, 60], yt: mode === 'one' ? [0, 0.5, 1] : [-1, 0, 1], xl: 'round' });
    G.text(ctx, '↑ value held by each node', pad.l, 9, P.muted, 'left', 11.5);
    for (var v2 = 0; v2 < n; v2++) {
      var pts = hs.map(function (hh, t2) { return [ax.X(t2), ax.Y(hh[v2])]; });
      G.line(ctx, pts, GROUP[v2] ? P.fp : P.accent, 1.6);
    }
    G.line(ctx, [[ax.X(K), pad.t], [ax.X(K), c.h - pad.b]], P.fg, 1.2, [4, 4]);
    G.text(ctx, 'now', Math.min(ax.X(K) + 4, c.w - pad.r - 26), pad.t + 8, P.fg, 'left', 11);
    // --- cards and readout ---
    var reachedN = h.filter(function (x) { return Math.abs(x) > 1e-12; }).length;
    var spread = Math.max.apply(null, h) - Math.min.apply(null, h);
    var mL = G.mean(h.slice(0, 4)), mR = G.mean(h.slice(4));
    k('reach').textContent = mode === 'one' ? reachedN + ' / 8' : '8 / 8';
    k('spread').textContent = G.fmt(spread, 3);
    k('gap').textContent = G.fmt(mL - mR, 3);
    var msg;
    if (mode === 'one') {
      if (K === 0) msg = 'Only A holds a value. Press <b>Next round</b>: each round, every node replaces its value with the average of itself and its neighbours.';
      else if (reachedN < 8) msg = 'After <b>' + K + '</b> round' + (K > 1 ? 's' : '') + ', A\'s information has reached every node within ' + K + ' hop' + (K > 1 ? 's' : '') + ' (' + reachedN + ' of 8) and no further. A GNN with k layers can only see a k-hop neighbourhood.';
      else if (spread > 0.05) msg = 'All 8 nodes have heard from A by round 5, the graph\'s farthest hop. Keep going and the values keep flattening (spread ' + G.fmt(spread, 3) + '): the single narrow bridge C–D slows the mixing.';
      else msg = 'After ' + K + ' rounds every node holds nearly the same number (spread ' + G.fmt(spread, 3) + '). Nothing about where the information started survives. This is <b>over-smoothing</b>.';
    } else {
      if (K === 0) msg = 'Left group starts at +1, right group at −1. A classifier could separate them perfectly. Step through rounds and watch the gap between group averages.';
      else if (Math.abs(mL - mR) > 0.8) msg = 'After ' + K + ' rounds the groups are still clearly apart (gap ' + G.fmt(mL - mR, 2) + '). Nodes near the bridge (D and E) have already blurred: they mix with the other side first.';
      else if (Math.abs(mL - mR) > 0.1) msg = 'After ' + K + ' rounds the gap between groups has shrunk to ' + G.fmt(mL - mR, 2) + '. Each extra round of averaging erases more of what made the groups different.';
      else msg = 'After ' + K + ' rounds the two groups are indistinguishable (gap ' + G.fmt(mL - mR, 3) + '). Stack too many plain message-passing layers and every node ends up with the same representation: <b>over-smoothing</b>.';
    }
    out.innerHTML = msg;
  }
  G.on(sK, 'input', draw);
  G.on(bOne, 'click', function () { mode = 'one'; draw(); });
  G.on(bTwo, 'click', function () { mode = 'two'; draw(); });
  G.on(bNext, 'click', function () { sK.value = Math.min(KMAX, +sK.value + 1); draw(); });
  G.on(bReset, 'click', function () { sK.value = 0; draw(); });
  return draw;
});

/* A 3x3 filter sliding over a 12x12 image ("valid" positions only, so the output is 10x10).
   Like deep-learning libraries, this computes cross-correlation: the filter is not flipped. */
G.widget('w-fm-conv', function (root) {
  var sK = G.$(root, '#cv-k'), bStep = G.$(root, '[data-step]'), bRun = G.$(root, '[data-run]'), bAll = G.$(root, '[data-all]'), bReset = G.$(root, '[data-reset]');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]'), k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  var N = 12, M = N - 2, img = [], r, c;
  for (r = 0; r < N; r++) { img.push([]); for (c = 0; c < N; c++) img[r].push(0); }
  for (c = 2; c <= 9; c++) { img[2][c] = 1; img[3][c] = 1; }        // the bar of the T
  for (r = 4; r <= 9; r++) { img[r][5] = 1; img[r][6] = 1; }        // the stem
  var NINTH = 1 / 9;
  var K = {
    v: [[1, 0, -1], [2, 0, -2], [1, 0, -1]],
    h: [[1, 2, 1], [0, 0, 0], [-1, -2, -1]],
    blur: [[NINTH, NINTH, NINTH], [NINTH, NINTH, NINTH], [NINTH, NINTH, NINTH]],
    sharp: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]]
  };
  var cur = 44, timer = null, geom = null;
  function conv(f, i, j) { var s = 0; for (var u = 0; u < 3; u++) for (var v = 0; v < 3; v++) s += f[u][v] * img[i + u][j + v]; return s; }
  function comma(n) { return G.fmt(n, 0).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function wtxt(w, blur) { return blur ? (w ? '1/9' : '0') : G.fmt(w, 0).replace('-', '−'); }
  function vtxt(v, blur) { return blur ? G.fmt(v, 3) : G.fmt(v, 0).replace('-', '−'); }

  function draw() {
    var P = G.pal(), key = sK.value, f = K[key], blur = key === 'blur';
    bRun.setAttribute('aria-pressed', timer ? 'true' : 'false'); bRun.textContent = timer ? 'Pause' : 'Run';
    var O = [], mx = 1e-9;
    for (r = 0; r < M; r++) { O.push([]); for (c = 0; c < M; c++) { var o = conv(f, r, c); O[r].push(o); mx = Math.max(mx, Math.abs(o)); } }
    var ci = Math.floor(cur / M), cj = cur % M;
    var W = cv.parentElement.clientWidth || 640, wide = W >= 600;
    var s = wide ? Math.min(22, Math.floor((W - 90) / 22)) : Math.max(10, Math.floor((W - 30) / 22));
    var gap = wide ? 70 : 24, x0 = Math.max(4, (W - 22 * s - gap) / 2), y0 = 26, xo = x0 + N * s + gap, yo = y0 + s;
    var g = wide ? 32 : 28, by = y0 + N * s + 46;
    var H = wide ? by + 3 * g + 26 : by + 2 * (3 * g + 30) + 6;
    var cc = G.canvas(cv, H), ctx = cc.ctx;
    var font = G.css('--font-mono', 'monospace');

    function cellFill(x, y, sz, v, m, isPix) {
      ctx.fillStyle = P.surface; ctx.fillRect(x, y, sz, sz);
      if (isPix) { ctx.globalAlpha = 0.9 * v; ctx.fillStyle = P.fg; }
      else { ctx.globalAlpha = v ? 0.12 + 0.78 * Math.min(1, Math.abs(v) / m) : 0; ctx.fillStyle = v > 0 ? P.accent : P.lead; }
      ctx.fillRect(x, y, sz, sz); ctx.globalAlpha = 1;
      ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, sz - 1, sz - 1);
    }
    // Input image and output map.
    G.text(ctx, 'input image, 12 × 12', x0, 12, P.muted, 'left', 12);
    G.text(ctx, 'output map, 10 × 10', xo, 12, P.muted, 'left', 12);
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) cellFill(x0 + c * s, y0 + r * s, s, img[r][c], 1, true);
    for (r = 0; r < M; r++) for (c = 0; c < M; c++) {
      var x = xo + c * s, y = yo + r * s;
      if (r * M + c <= cur) cellFill(x, y, s, O[r][c], mx, false);
      else { ctx.fillStyle = P.sunk; ctx.fillRect(x, y, s, s); ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1); }
    }
    // The window being read, the cell being written, and a faint link between them.
    var wx = x0 + cj * s, wy = y0 + ci * s, ox = xo + cj * s, oy = yo + ci * s;
    G.line(ctx, [[wx + 3 * s, wy + 1.5 * s], [ox, oy + s / 2]], P.faint, 1, [3, 4]);
    ctx.strokeStyle = P.accent; ctx.lineWidth = 2.5; ctx.strokeRect(wx - 1, wy - 1, 3 * s + 2, 3 * s + 2);
    ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.strokeRect(ox - 1, oy - 1, s + 2, s + 2);
    geom = { x0: x0, y0: y0, xo: xo, yo: yo, s: s };

    // The arithmetic for this position: window × filter = 9 products, summed.
    function grid(gx, gy, title, val, txt, m, isPix) {
      G.text(ctx, title, gx, gy - 11, P.muted, 'left', 11.5);
      for (var u = 0; u < 3; u++) for (var v = 0; v < 3; v++) {
        var X = gx + v * g, Y = gy + u * g, vv = val(u, v);
        cellFill(X, Y, g, vv, m, isPix);
        var dark = isPix ? vv > 0.5 : Math.abs(vv) / m > 0.6;
        ctx.font = (g > 30 ? 12 : 11) + 'px ' + font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = dark ? P.surface : P.fg; ctx.fillText(txt(u, v), X + g / 2, Y + g / 2);
      }
    }
    var fmax = 0; f.forEach(function (row) { row.forEach(function (w) { fmax = Math.max(fmax, Math.abs(w)); }); });
    var pix = function (u, v) { return img[ci + u][cj + v]; }, prod = function (u, v) { return f[u][v] * img[ci + u][cj + v]; };
    var sum = O[ci][cj], nz = 0; for (var u = 0; u < 3; u++) for (var v = 0; v < 3; v++) if (prod(u, v)) nz++;
    var sumTxt = blur ? nz + '/9 = ' + G.fmt(sum, 3) : vtxt(sum, false);
    var gw = 3 * g, sym = 28;
    if (wide) {
      var bx = Math.max(4, (W - (3 * gw + 2 * sym + 190)) / 2);
      grid(bx, by, 'window pixels', pix, function (u, v) { return G.fmt(pix(u, v), 0); }, 1, true);
      G.text(ctx, '×', bx + gw + sym / 2, by + gw / 2, P.fg, 'center', 18);
      grid(bx + gw + sym, by, 'filter weights', function (u, v) { return f[u][v]; }, function (u, v) { return wtxt(f[u][v], blur); }, fmax, false);
      G.text(ctx, '=', bx + 2 * gw + 1.5 * sym, by + gw / 2, P.fg, 'center', 18);
      grid(bx + 2 * gw + 2 * sym, by, '9 products', prod, function (u, v) { return wtxt(prod(u, v), blur); }, fmax, false);
      var sx = bx + 3 * gw + 2 * sym + 16;
      G.text(ctx, 'add them up:', sx, by + gw / 2 - 12, P.muted, 'left', 12);
      G.text(ctx, 'sum = ' + sumTxt, sx, by + gw / 2 + 10, P.fg, 'left', 14);
    } else {
      var bx1 = Math.max(4, (W - (2 * gw + sym)) / 2);
      grid(bx1, by, 'window pixels', pix, function (u, v) { return G.fmt(pix(u, v), 0); }, 1, true);
      G.text(ctx, '×', bx1 + gw + sym / 2, by + gw / 2, P.fg, 'center', 18);
      grid(bx1 + gw + sym, by, 'filter weights', function (u, v) { return f[u][v]; }, function (u, v) { return wtxt(f[u][v], blur); }, fmax, false);
      var by2 = by + gw + 30;
      grid(bx1, by2, '9 products', prod, function (u, v) { return wtxt(prod(u, v), blur); }, fmax, false);
      G.text(ctx, 'add them up:', bx1 + gw + 14, by2 + gw / 2 - 12, P.muted, 'left', 12);
      G.text(ctx, 'sum = ' + sumTxt, bx1 + gw + 14, by2 + gw / 2 + 10, P.fg, 'left', 14);
    }

    // Cards and readout.
    var dense = N * N * M * M, big = 224 * 224 * 3 * 224 * 224 * 64, small = 3 * 3 * 3 * 64;
    k('w').textContent = G.fmt(9, 0); k('pos').textContent = G.fmt(M * M, 0); k('dense').textContent = comma(dense); k('val').textContent = vtxt(sum, blur);
    var what = {
      v: 'This filter subtracts the right column from the left column (the middle column counts double). It is positive where the left side of the window is brighter, negative where the right side is, and 0 on flat patches, so it lights up the vertical sides of the stem and the ends of the bar.',
      h: 'This filter subtracts the bottom row from the top row. It is positive where the top of the window is brighter, negative where the bottom is, and 0 on flat patches, so it lights up the top and bottom of the bar and the foot of the stem.',
      blur: 'Every weight is 1/9, so each output is the average brightness of the 9 pixels. Sharp edges become soft ramps.',
      sharp: 'The centre pixel counts 5 times and its four neighbours are subtracted. Flat patches keep their value (5 − 4 = 1 times the pixel), while pixels next to a change are pushed further apart: brighter on the bright side, negative on the dark side.'
    }[key];
    var done = cur >= M * M - 1;
    out.innerHTML = 'Position ' + G.fmt(cur + 1, 0) + ' of ' + G.fmt(M * M, 0) + ' (row ' + G.fmt(ci + 1, 0) + ', column ' + G.fmt(cj + 1, 0) + '): the 9 products add up to <b>' + sumTxt + '</b>. ' + what + ' ' +
      '<b>Weight sharing:</b> the same 9 weights are reused at all ' + G.fmt(M * M, 0) + ' positions' + (done ? '' : ' (press Fill all to see the whole map)') + '. A dense layer connecting all ' + G.fmt(N * N, 0) + ' pixels to all ' + G.fmt(M * M, 0) +
      ' outputs would need ' + comma(dense) + ' weights, ' + comma(dense / 9) + ' times more, and would have to learn the same detector separately at every position. ' +
      'At real scale the gap is enormous: for a 224 × 224 colour image and 64 output channels, a 3 × 3 convolution has ' + comma(small) + ' weights; a dense layer with the same input and output sizes would have about ' + comma(big / 1e9) + ' billion (biases ignored in both counts).';
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function tick() { if (cur < M * M - 1) { cur++; draw(); } else { stop(); draw(); } }
  G.on(bStep, 'click', function () { stop(); if (cur >= M * M - 1) cur = 0; else cur++; draw(); });
  G.on(bRun, 'click', function () {
    if (timer) { stop(); draw(); return; }
    if (cur >= M * M - 1) cur = 0;
    timer = setInterval(tick, 90); draw();
  });
  G.on(bAll, 'click', function () { stop(); cur = M * M - 1; draw(); });
  G.on(bReset, 'click', function () { stop(); cur = 0; draw(); });
  G.on(sK, 'change', draw);
  cv.addEventListener('click', function (e) {
    if (!geom) return;
    var b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, s = geom.s, i, j;
    if (x >= geom.x0 && x < geom.x0 + N * s && y >= geom.y0 && y < geom.y0 + N * s) {   // input pixel: centre the window on it
      i = Math.floor((y - geom.y0) / s) - 1; j = Math.floor((x - geom.x0) / s) - 1;
    } else if (x >= geom.xo && x < geom.xo + M * s && y >= geom.yo && y < geom.yo + M * s) {
      i = Math.floor((y - geom.yo) / s); j = Math.floor((x - geom.xo) / s);
    } else return;
    stop(); cur = Math.max(0, Math.min(M - 1, i)) * M + Math.max(0, Math.min(M - 1, j)); draw();
  });
  return draw;
});
