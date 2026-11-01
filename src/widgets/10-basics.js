G.widget('w-sp-explorer', function (root) {
  var sOut = G.$(root, '#sp-out'), sWide = G.$(root, '#sp-wide'), oOut = G.$(root, '#sp-out-o'), oWide = G.$(root, '#sp-wide-o');
  var cvStrip = G.$(root, 'canvas[data-c=strip]'), cvOwn = G.$(root, 'canvas[data-c=own]'), out = G.$(root, '[data-out]');
  var k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  // 24 fixed "everyday" response times around 4 s, generated once from a seeded lognormal-ish draw
  var r = G.rng(7), base = [];
  for (var i = 0; i < 24; i++) base.push(G.gauss(r));
  function quant(sorted, q) { return G.quantile(sorted, q); }
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return quant(s, 0.5); }
  function stats(x) {
    var n = x.length, m = G.mean(x), sq = x.map(function (v) { return (v - m) * (v - m); }), v = G.sum(sq) / (n - 1);
    var s = x.slice().sort(function (a, b) { return a - b; }), med = quant(s, 0.5);
    var mad = median(x.map(function (v) { return Math.abs(v - med); }));
    return { m: m, v: v, sd: Math.sqrt(v), q1: quant(s, 0.25), q3: quant(s, 0.75), med: med, mad: mad, sq: sq };
  }
  var clean = null;
  function draw() {
    var P = G.pal(), wide = +sWide.value, outV = +sOut.value;
    oOut.textContent = G.fmt(outV, 1); oWide.textContent = G.fmt(wide, 2) + '×';
    var x = base.map(function (z) { return Math.max(0.6, 4 * Math.exp(0.18 * wide * z)); });
    clean = stats(x.concat([4]));
    x = x.concat([outV]);
    var st = stats(x), n = x.length;
    var xmax = Math.max(12, outV * 1.08, st.m + st.sd * 1.1);

    /* strip plot with the three bands */
    var c = G.canvas(cvStrip, 200), ctx = c.ctx, pad = { l: 16, r: 16, t: 14, b: 30 };
    var ax = G.axes(ctx, c.w, c.h, pad, { x: [0, xmax], y: [0, 1], xt: niceTicks(xmax), xl: 'seconds' });
    function band(lo, hi, y, h, col, label) {
      var a = Math.max(0, lo), b = Math.min(xmax, hi);
      ctx.fillStyle = col; ctx.globalAlpha = 0.14; ctx.fillRect(ax.X(a), y, ax.X(b) - ax.X(a), h); ctx.globalAlpha = 1;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax.X(a), y + h / 2); ctx.lineTo(ax.X(b), y + h / 2); ctx.stroke();
      [a, b].forEach(function (e) { ctx.beginPath(); ctx.moveTo(ax.X(e), y + 3); ctx.lineTo(ax.X(e), y + h - 3); ctx.stroke(); });
      G.text(ctx, label, Math.min(ax.X(b) + 8, c.w - 150), y + h / 2, col, 'left', 11.5);
    }
    band(st.m - st.sd, st.m + st.sd, 14, 22, P.accent, 'mean ± SD');
    G.dot(ctx, ax.X(st.m), 25, 4, P.accent);
    band(st.q1, st.q3, 42, 22, P.tp, 'IQR');
    G.dot(ctx, ax.X(st.med), 53, 4, P.tp);
    band(st.med - 1.4826 * st.mad, st.med + 1.4826 * st.mad, 70, 22, P.eli5, 'median ± MAD');
    var jr = G.rng(3);
    x.forEach(function (v, j) {
      var yy = 125 + (jr() - 0.5) * 34, last = j === n - 1;
      G.dot(ctx, ax.X(Math.min(v, xmax)), yy, last ? 6.5 : 4.5, last ? P.fp : P.tn, last ? P.surface : null);
    });

    /* who owns the variance */
    var c2 = G.canvas(cvOwn, 150), ctx2 = c2.ctx, pd = { l: 44, r: 16, t: 22, b: 26 };
    var tot = G.sum(st.sq), shares = st.sq.map(function (q) { return q / tot; });
    var ymax = Math.max(0.2, Math.min(1, Math.max.apply(null, shares) * 1.15));
    var a2 = G.axes(ctx2, c2.w, c2.h, pd, { x: [0, n], y: [0, ymax], yt: [0, ymax / 2, ymax], yf: function (v) { return Math.round(v * 100) + '%'; }, yl: 'share of total variance' });
    var bw = (c2.w - pd.l - pd.r) / n;
    var order = x.map(function (v, j) { return j; }).sort(function (a, b) { return x[a] - x[b]; });
    order.forEach(function (j, pos) {
      var h = a2.Y(0) - a2.Y(shares[j]);
      ctx2.fillStyle = j === n - 1 ? P.fp : P.accent; ctx2.globalAlpha = j === n - 1 ? 1 : 0.55;
      ctx2.fillRect(pd.l + pos * bw + 1.5, a2.Y(shares[j]), Math.max(1, bw - 3), h); ctx2.globalAlpha = 1;
    });
    G.text(ctx2, 'points sorted from fastest to slowest', c2.w - pd.r, c2.h - 8, P.faint, 'right', 11);

    k('var').textContent = G.fmt(st.v, 2); k('sd').textContent = G.fmt(st.sd, 2) + ' s';
    k('iqr').textContent = G.fmt(st.q3 - st.q1, 2) + ' s'; k('mad').textContent = G.fmt(1.4826 * st.mad, 2) + ' s';
    var own = shares[n - 1], ratio = st.sd / (1.4826 * st.mad || 1e-9);
    out.innerHTML = 'Your request alone owns <b>' + G.pct(own) + '</b> of the variance. Compared with a typical 4 s request, SD is <b>' + G.fmt(st.sd / clean.sd, 1) +
      '×</b> larger, IQR <b>' + G.fmt((st.q3 - st.q1) / (clean.q3 - clean.q1), 2) + '×</b>, MAD <b>' + G.fmt(st.mad / (clean.mad || 1e-9), 2) + '×</b>. ' +
      (ratio > 1.5 ? 'SD is ' + G.fmt(ratio, 1) + '× the scaled MAD: a heavy tail or outlier is driving the squared measures.' : 'SD and scaled MAD agree: no single point is dominating.');
  }
  function niceTicks(m) { var step = m > 40 ? 10 : m > 20 ? 5 : 2, t = []; for (var v = 0; v <= m; v += step) t.push(v); return t; }
  G.on([sOut, sWide], 'input', draw);
  return draw;
});
