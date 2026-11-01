/* Chapter 36: temperature reshapes one pass's odds; thinking steps add computation. Two independent knobs. */
G.widget('w-rs-knobs', function (root) {
  var sT = G.$(root, '#rs-t'), sS = G.$(root, '#rs-s'), oT = G.$(root, '#rs-t-o'), oS = G.$(root, '#rs-s-o');
  var cvD = G.$(root, '[data-cv=dist]'), cvA = G.$(root, '[data-cv=acc]'), out = G.$(root, '[data-out]');
  function k(n) { return G.$(root, '[data-k=' + n + ']'); }
  // Illustrative logits for the first answer token of "17 x 24 =" with no working. "408" is correct.
  var ANS = ['398', '408', '418', '388', '428', 'other'], Z = [2.0, 1.7, 1.0, 0.8, 0.5, 0.2], RIGHT = 1;
  var F = 0.22, TOK_STEP = 60, TOK_ANS = 10, TPS = 80, PREFILL = 0.3, PRICE = 10; // $ per 1M output tokens
  function slip(T) { return 0.015 + 0.02 * T; }  // per-step chance of breaking right working; temperature nudges it
  function accAt(a0, s, e) { var ainf = F / (F + e); return ainf + (a0 - ainf) * Math.pow(1 - F - e, s); }
  function draw() {
    var P = G.pal(), T = +sT.value, s = +sS.value;
    oT.textContent = G.fmt(T, 2); oS.textContent = s;
    var p = G.softmax(Z.map(function (z) { return z / T; }));
    var H = -G.sum(p.map(function (q) { return q > 0 ? q * Math.log2(q) : 0; }));
    var top = p.indexOf(Math.max.apply(null, p)), a0 = p[RIGHT], e = slip(T), acc = accAt(a0, s, e);
    var toks = s * TOK_STEP + TOK_ANS, lat = PREFILL + toks / TPS, cost = toks * 1000 * PRICE / 1e6;

    // left: bar chart of the next-token odds
    var c = G.canvas(cvD, 240), ctx = c.ctx, pad = { l: 40, r: 10, t: 26, b: 40 };
    var ax = G.axes(ctx, c.w, c.h, pad, { x: [0, ANS.length], y: [0, 1], yt: [0, 0.25, 0.5, 0.75, 1], yf: function (v) { return G.pct(v); } });
    var bw = (c.w - pad.l - pad.r) / ANS.length;
    p.forEach(function (q, i) {
      var x0 = pad.l + i * bw + bw * 0.18, w = bw * 0.64, y = ax.Y(q);
      ctx.fillStyle = i === RIGHT ? P.good : P.accent; ctx.globalAlpha = i === top ? 1 : 0.75;
      ctx.fillRect(x0, y, w, ax.Y(0) - y); ctx.globalAlpha = 1;
      G.text(ctx, G.pct(q), x0 + w / 2, y - 9, P.fg, 'center', 11.5);
      G.text(ctx, ANS[i] + (i === RIGHT ? ' ✓' : ''), x0 + w / 2, c.h - pad.b + 14, i === RIGHT ? P.good : P.fg, 'center', 12);
    });
    G.text(ctx, 'odds of the answer token · spread ' + G.fmt(H, 2) + ' bits', pad.l, 12, P.muted, 'left', 12);
    G.text(ctx, '1 forward pass at any temperature', c.w / 2, c.h - 8, P.muted, 'center', 11.5);

    // right: accuracy against thinking steps, with latency as a second scale
    var c2 = G.canvas(cvA, 240), x2 = c2.ctx, pd = { l: 40, r: 40, t: 26, b: 40 }, SMAX = 20;
    var ay = G.axes(x2, c2.w, c2.h, pd, { x: [0, SMAX], y: [0, 1], xt: [0, 5, 10, 15, 20], yt: [0, 0.25, 0.5, 0.75, 1], yf: function (v) { return G.pct(v); } });
    var LMAX = PREFILL + (SMAX * TOK_STEP + TOK_ANS) / TPS;
    function LY(l) { return ay.Y(l / LMAX); }
    var lat_pts = [], acc_pts = [];
    for (var i = 0; i <= SMAX; i++) {
      lat_pts.push([ay.X(i), LY(PREFILL + (i * TOK_STEP + TOK_ANS) / TPS)]);
      acc_pts.push([ay.X(i), ay.Y(accAt(a0, i, e))]);
    }
    G.line(x2, lat_pts, P.fn, 1.5, [5, 4]);
    G.line(x2, acc_pts, P.deep, 2.5);
    x2.fillStyle = P.faint; x2.font = '11px ' + G.css('--font-body', 'sans-serif'); x2.textAlign = 'left'; x2.textBaseline = 'middle';
    [0, 5, 10, 15].forEach(function (l) { x2.fillText(l + 's', c2.w - pd.r + 6, LY(l)); });
    x2.save(); x2.strokeStyle = P.line; x2.setLineDash([2, 3]); x2.beginPath(); x2.moveTo(ay.X(s), pd.t); x2.lineTo(ay.X(s), c2.h - pd.b); x2.stroke(); x2.restore();
    G.dot(x2, ay.X(s), ay.Y(acc), 5.5, P.deep, P.surface);
    G.dot(x2, ay.X(s), LY(lat), 4.5, P.fn, P.surface);
    G.text(x2, 'accuracy', pd.l + 6, 12, P.deep, 'left', 12);
    G.text(x2, '- - latency', pd.l + 72, 12, P.fn, 'left', 12);
    G.text(x2, 'thinking steps (60 tokens each)', (pd.l + c2.w - pd.r) / 2, c2.h - 8, P.muted, 'center', 11.5);

    k('p0').textContent = G.pct(a0);
    k('acc').textContent = G.pct(acc); k('lat').textContent = G.fmt(lat, 1) + ' s'; k('cost').textContent = '$' + G.fmt(cost, 2);
    var tempMsg = T < 0.5 ? 'Low temperature piles the odds onto the favourite, <b>' + ANS[top] + '</b>' + (top === RIGHT ? '.' : ', which is wrong, so the model becomes consistently wrong.')
      : T > 1.4 ? 'High temperature flattens the odds (entropy ' + G.fmt(H, 2) + ' bits), so answers vary more between runs.'
      : 'At this temperature the favourite is <b>' + ANS[top] + '</b>' + (top === RIGHT ? '.' : ' (wrong) and the right answer gets ' + G.pct(a0) + '.');
    out.innerHTML = '<b>Temperature</b> changed only the spread of the odds (entropy ' + G.fmt(H, 2) + ' bits). ' + tempMsg + ' The network did the same single forward pass either way. ' +
      '<b>Thinking</b> ' + (s === 0 ? 'is off, so accuracy equals the left panel: ' + G.pct(a0) + '.' :
        'added ' + G.big(s * TOK_STEP) + ' tokens of computation before the answer, moving accuracy from ' + G.pct(a0) + ' to <b>' + G.pct(acc) + '</b>, at ' + G.fmt(lat, 1) + ' s and $' + G.fmt(cost, 2) + ' per 1,000 answers.') +
      (s >= 12 ? ' Past about ten steps the curve is flat: you keep paying for latency without buying accuracy.' : '');
  }
  G.on([sT, sS], 'input', draw);
  return draw;
});
