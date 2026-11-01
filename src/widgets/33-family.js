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
