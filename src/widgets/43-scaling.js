G.widget('w-sc-plan', function (root) {
  var E = 1.69, A = 406.4, B = 410.7, a = 0.34, b = 0.28;   // Hoffmann et al. 2022, approach 3
  var cS = G.$(root, '#sc-c'), rS = G.$(root, '#sc-r'), gS = G.$(root, '#sc-g'), mS = G.$(root, '#sc-m'), hw = G.$(root, '#sc-hw');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  function L(N, D) { return E + A / Math.pow(N, a) + B / Math.pow(D, b); }
  function split(C, r) { var N = Math.sqrt(C / (6 * r)); return [N, r * N]; }
  function draw() {
    var P = G.pal(), C = Math.pow(10, parseFloat(cS.value)), ratio = Math.pow(10, parseFloat(rS.value)), gpus = Math.pow(2, parseInt(gS.value, 10));
    var mfu = parseFloat(mS.value), peak = parseFloat(hw.value);
    G.$(root, '#sc-c-o').textContent = G.sci(C); G.$(root, '#sc-r-o').textContent = G.fmt(ratio, 0);
    G.$(root, '#sc-g-o').textContent = gpus.toLocaleString(); G.$(root, '#sc-m-o').textContent = G.pct(mfu);
    var nd = split(C, ratio), N = nd[0], D = nd[1];
    var secs = C / (gpus * peak * mfu), days = secs / 86400, gh = gpus * secs / 3600;
    // best ratio under the fitted law at this C
    var best = { r: 20, l: Infinity }, curve = [];
    for (var lr = 0; lr <= 3.3001; lr += 0.02) { var rr = Math.pow(10, lr), s = split(C, rr), l = L(s[0], s[1]); curve.push([lr, l]); if (l < best.l) best = { r: rr, l: l }; }
    var here = L(N, D);
    G.$(root, '[data-n]').textContent = G.big(N); G.$(root, '[data-d]').textContent = G.big(D);
    G.$(root, '[data-days]').textContent = days < 1 ? G.fmt(days * 24, 1) + ' h' : G.fmt(days, days < 10 ? 1 : 0);
    G.$(root, '[data-gh]').textContent = G.big(gh);
    G.$(root, '[data-dl]').textContent = '+' + G.fmt(here - best.l, 3);
    var ymin = best.l - 0.02, ymax = Math.max.apply(null, curve.map(function (p) { return p[1]; }));
    ymax = Math.min(ymax, best.l + 0.35);
    var c = G.canvas(cv, 210), ctx = c.ctx, pad = { l: 48, r: 14, t: 12, b: 34 };
    var s = G.axes(ctx, c.w, c.h, pad, { x: [0, 3.3], y: [ymin, ymax], xt: [0, 1, 2, 3], xf: function (v) { return Math.pow(10, v).toLocaleString(); }, yt: [ymin, (ymin + ymax) / 2, ymax], yf: function (v) { return G.fmt(v, 2); }, xl: 'tokens per parameter (log scale)', yl: 'predicted loss' });
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, c.w - pad.l - pad.r, c.h - pad.t - pad.b); ctx.clip();
    G.line(ctx, curve.map(function (p) { return [s.X(p[0]), s.Y(p[1])]; }), P.accent, 2); ctx.restore();
    ctx.strokeStyle = P.faint; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(s.X(Math.log10(20)), pad.t); ctx.lineTo(s.X(Math.log10(20)), c.h - pad.b); ctx.stroke(); ctx.setLineDash([]);
    G.text(ctx, '20 (Chinchilla rule)', s.X(Math.log10(20)) + 4, pad.t + 8, P.faint, 'left', 11);
    G.dot(ctx, s.X(Math.log10(best.r)), s.Y(best.l), 4, P.tp);
    G.dot(ctx, s.X(Math.log10(ratio)), s.Y(Math.min(here, ymax)), 6, P.fg, P.surface);
    out.innerHTML = 'At ' + G.sci(C) + ' FLOPs the fitted law is minimised near <b>' + G.fmt(best.r, 0) + ' tokens per parameter</b> (green). ' +
      'Your split trains a ' + G.big(N) + '-parameter model on ' + G.big(D) + ' tokens in about ' + (days < 1 ? G.fmt(days * 24, 1) + ' hours' : G.fmt(days, 0) + ' days') + ' on ' + gpus.toLocaleString() + ' GPUs. ' +
      (ratio > 100 ? 'Over-training costs ' + G.fmt(here - best.l, 3) + ' in loss but gives a model ' + G.fmt(Math.sqrt(ratio / best.r), 1) + '× smaller to serve.' : '') +
      ' The fitted optimum differs from the 20:1 rule because the parametric fit and the rule of thumb came from different analyses in the same paper.';
  }
  G.on([cS, rS, gS, mS], 'input', draw); G.on(hw, 'change', draw);
  return draw;
});

G.widget('w-sc-emerge', function (root) {
  var kS = G.$(root, '#sc-k'), xS = G.$(root, '#sc-x'), cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  function p(x) { return G.sigmoid(1.6 * (x - 22.2)); }
  function draw() {
    var P = G.pal(), k = parseInt(kS.value, 10), x0 = parseFloat(xS.value);
    G.$(root, '#sc-k-o').textContent = k; G.$(root, '#sc-x-o').textContent = '1e' + G.fmt(x0, 1);
    var c = G.canvas(cv, 230), ctx = c.ctx, pad = { l: 44, r: 14, t: 12, b: 34 };
    var s = G.axes(ctx, c.w, c.h, pad, { x: [20, 26], y: [0, 1], xt: [20, 21, 22, 23, 24, 25, 26], xf: function (v) { return '1e' + v; }, yt: [0, .25, .5, .75, 1], yf: function (v) { return Math.round(v * 100) + '%'; }, xl: 'training compute (FLOPs)', yl: 'score' });
    var a1 = [], a2 = [], a3 = [];
    for (var x = 20; x <= 26.001; x += 0.05) {
      var q = p(x); a1.push([s.X(x), s.Y(q)]); a2.push([s.X(x), s.Y(Math.pow(q, k))]);
      a3.push([s.X(x), s.Y(Math.max(0, 1 + k * Math.log(Math.max(q, 1e-9)) / (k * Math.log(1 / p(20)))))]);
    }
    G.line(ctx, a1, P.tp, 2); G.line(ctx, a2, P.fp, 2.5); G.line(ctx, a3, P.eli5, 1.5, [5, 4]);
    var q0 = p(x0); G.dot(ctx, s.X(x0), s.Y(q0), 5, P.tp); G.dot(ctx, s.X(x0), s.Y(Math.pow(q0, k)), 5, P.fp);
    ctx.strokeStyle = P.faint; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(s.X(x0), pad.t); ctx.lineTo(s.X(x0), c.h - pad.b); ctx.stroke(); ctx.setLineDash([]);
    var ly = pad.t + 30;
    [['per-token accuracy', P.tp], ['exact match on ' + k + ' tokens', P.fp], ['log likelihood of the answer (rescaled)', P.eli5]].forEach(function (L) { ctx.fillStyle = L[1]; ctx.fillRect(pad.l + 14, ly - 4, 10, 8); G.text(ctx, L[0], pad.l + 30, ly, P.muted, 'left', 11); ly += 16; });
    out.innerHTML = 'At 1e' + G.fmt(x0, 1) + ' FLOPs, per-token accuracy is <b>' + G.pct(q0) + '</b> but exact match on a ' + k + '-token answer is only <b>' + G.pct(Math.pow(q0, k), 1) + '</b>. ' +
      (k >= 8 ? 'The red curve looks like a capability that "emerges" suddenly. The green and blue curves show the model was improving steadily all along.' : 'With short answers the two metrics move together, so nothing looks sudden.');
  }
  G.on([kS, xS], 'input', draw);
  return draw;
});
