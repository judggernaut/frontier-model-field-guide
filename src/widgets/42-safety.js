/* Safety chapter widget: refusal threshold on a helpfulness vs harmlessness frontier. */
G.widget('w-sa-front', function (root) {
  var st = G.$(root, '#sa-t'), sq = G.$(root, '#sa-q'), sh = G.$(root, '#sa-h'), sc = G.$(root, '#sa-c');
  var cvD = G.$(root, 'canvas[data-cv="dist"]'), cvF = G.$(root, 'canvas[data-cv="front"]'), out = G.$(root, '[data-out]');
  var SD = 0.15, OLD = 0.18;
  function rates(t, sep) {
    var mb = 0.5 - sep / 2, mh = 0.5 + sep / 2;
    return { fpr: 1 - G.ncdf((t - mb) / SD), fnr: G.ncdf((t - mh) / SD) };
  }
  function draw() {
    var t = +st.value, sep = +sq.value, pi = +sh.value, C = +sc.value, P = G.pal();
    G.$(root, '#sa-t-o').textContent = G.fmt(t, 2);
    G.$(root, '#sa-q-o').textContent = sep < 0.2 ? 'Weak' : sep < 0.32 ? 'Fair' : sep < 0.45 ? 'Good' : 'Strong';
    G.$(root, '#sa-h-o').textContent = G.pct(pi, pi < 0.01 ? 1 : 0);
    G.$(root, '#sa-c-o').textContent = C + '×';
    var r = rates(t, sep), best = { t: 0.5, cost: Infinity };
    for (var i = 1; i < 100; i++) { var tt = i / 100, q = rates(tt, sep), cost = (1 - pi) * q.fpr + pi * C * q.fnr; if (cost < best.cost) best = { t: tt, cost: cost, fpr: q.fpr, fnr: q.fnr }; }
    // distributions
    var c = G.canvas(cvD, 220), x = c.ctx, pad = { l: 14, r: 10, t: 16, b: 34 };
    var s = G.axes(x, c.w, c.h, pad, { x: [0, 1], y: [0, 1.1], xt: [0, 0.5, 1], xl: 'safety score (refuse above threshold)' });
    function curve(m, col) {
      var pts = [[s.X(0), s.Y(0)]];
      for (var k = 0; k <= 100; k++) { var v = k / 100; pts.push([s.X(v), s.Y(Math.exp(-Math.pow((v - m) / SD, 2) / 2))]); }
      pts.push([s.X(1), s.Y(0)]);
      x.save(); x.beginPath(); pts.forEach(function (p, j) { j ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); }); x.closePath();
      x.fillStyle = col; x.globalAlpha = 0.18; x.fill(); x.globalAlpha = 1; x.strokeStyle = col; x.lineWidth = 2; x.stroke(); x.restore();
    }
    curve(0.5 - sep / 2, P.tn); curve(0.5 + sep / 2, P.fp);
    x.save(); x.strokeStyle = P.fg; x.lineWidth = 1.5; x.setLineDash([5, 4]); x.beginPath(); x.moveTo(s.X(t), pad.t); x.lineTo(s.X(t), c.h - pad.b); x.stroke(); x.restore();
    G.text(x, 'answer', s.X(t) - 6, pad.t + 4, P.muted, 'right', 11); G.text(x, 'refuse', s.X(t) + 6, pad.t + 4, P.muted, 'left', 11);
    G.text(x, 'benign', s.X(0.5 - sep / 2), s.Y(1.04), P.tn, 'center', 11); G.text(x, 'harmful', s.X(0.5 + sep / 2), s.Y(1.04), P.fp, 'center', 11);
    // frontier
    var c2 = G.canvas(cvF, 220), y = c2.ctx, pd = { l: 46, r: 12, t: 12, b: 34 };
    var f = G.axes(y, c2.w, c2.h, pd, { x: [0, 1], y: [0, 1], xt: [0, 0.5, 1], yt: [0, 0.5, 1], xf: function (v) { return G.pct(v); }, yf: function (v) { return G.pct(v); }, xl: 'over-refusal rate', yl: 'unsafe compliance' });
    var A = [], B = [];
    for (var k = 0; k <= 200; k++) { var tt2 = k / 200, a = rates(tt2, OLD), b = rates(tt2, sep); A.push([f.X(a.fpr), f.Y(a.fnr)]); B.push([f.X(b.fpr), f.Y(b.fnr)]); }
    G.line(y, A, P.faint, 1.5, [5, 4]); G.line(y, B, P.accent, 2.5);
    G.dot(y, f.X(best.fpr), f.Y(best.fnr), 6, P.tp, P.surface);
    G.dot(y, f.X(r.fpr), f.Y(r.fnr), 6, P.fg, P.surface);
    G.text(y, 'ideal corner', f.X(0.02), f.Y(0.03), P.faint, 'left', 11);
    var prec = pi * (1 - r.fnr) / (pi * (1 - r.fnr) + (1 - pi) * r.fpr);
    G.$(root, '[data-or]').textContent = G.pct(r.fpr, 1); G.$(root, '[data-uc]').textContent = G.pct(r.fnr, 1);
    G.$(root, '[data-prec]').textContent = G.pct(prec); G.$(root, '[data-best]').textContent = G.fmt(best.t, 2);
    var per1k = 1000 * (1 - pi) * r.fpr, harm1k = 1000 * pi * r.fnr;
    out.innerHTML = 'Per 1,000 requests: about <b>' + G.fmt(per1k, 0) + '</b> benign requests refused and <b>' + G.fmt(harm1k, 1) + '</b> harmful ones answered. ' +
      'Only <b>' + G.pct(prec) + '</b> of refusals hit a harmful request, because harmful traffic is rare. ' +
      (Math.abs(best.t - t) < 0.03 ? 'You are at the cost-minimising threshold for this cost ratio.' : 'At a ' + C + '× cost ratio the expected cost is lowest at threshold <b>' + G.fmt(best.t, 2) + '</b> (green dot). ') +
      ' Improving training moves the solid curve toward the corner; moving the threshold only slides along it. Illustrative model.';
  }
  G.on([st, sq, sh, sc], 'input', draw);
  return draw;
});
