G.widget('w-se-compare', function (root) {
  var sN = G.$(root, '#se-n'), sS = G.$(root, '#se-sd'), oN = G.$(root, '#se-n-o'), oS = G.$(root, '#se-sd-o');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]'), k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  var NS = [5, 10, 25, 50, 100, 200, 400, 800, 1600];
  function draw() {
    var P = G.pal(), n = NS[+sN.value], sig = +sS.value, mu = 60;
    oN.textContent = n; oS.textContent = sig;
    var r = G.rng(11), sample = [];
    for (var i = 0; i < n; i++) sample.push(mu + sig * G.gauss(r));
    var means = [];
    for (var j = 0; j < 200; j++) { var t = 0; for (i = 0; i < n; i++) t += mu + sig * G.gauss(r); means.push(t / n); }
    var m = G.mean(sample), sd = Math.sqrt(G.sum(sample.map(function (v) { return (v - m) * (v - m); })) / (n - 1));
    var mm = G.mean(means), obs = Math.sqrt(G.sum(means.map(function (v) { return (v - mm) * (v - mm); })) / 199), se = sig / Math.sqrt(n);
    var c = G.canvas(cv, 230), ctx = c.ctx, pad = { l: 16, r: 16, t: 10, b: 30 };
    var ax = G.axes(ctx, c.w, c.h, pad, { x: [0, 120], y: [0, 1], xt: [0, 20, 40, 60, 80, 100, 120], xl: 'value' });
    G.text(ctx, 'individual values (one sample)', pad.l, 18, P.muted, 'left', 12);
    G.text(ctx, 'averages of 200 repeated samples', pad.l, 128, P.muted, 'left', 12);
    function bandAt(y, half, col, label) {
      ctx.fillStyle = col; ctx.globalAlpha = 0.13; ctx.fillRect(ax.X(mu - half), y - 26, ax.X(mu + half) - ax.X(mu - half), 52); ctx.globalAlpha = 1;
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; [mu - half, mu + half].forEach(function (e) { ctx.beginPath(); ctx.moveTo(ax.X(e), y - 26); ctx.lineTo(ax.X(e), y + 26); ctx.stroke(); });
      G.text(ctx, label, Math.min(ax.X(mu + half) + 6, c.w - 110), y - 18, col, 'left', 11.5);
    }
    bandAt(64, sig, P.accent, '±1 SD');
    bandAt(172, Math.max(se, 0.15), P.tp, '±1 SE');
    var jr = G.rng(5), show = sample.slice(0, 400);
    show.forEach(function (v) { G.dot(ctx, ax.X(Math.max(0, Math.min(120, v))), 64 + (jr() - 0.5) * 44, n > 200 ? 2 : 3, P.tn); });
    means.forEach(function (v) { G.dot(ctx, ax.X(v), 172 + (jr() - 0.5) * 44, 2.4, P.tp); });
    k('sd').textContent = G.fmt(sd, 2); k('se').textContent = G.fmt(se, 3); k('obs').textContent = G.fmt(obs, 3); k('vm').textContent = G.fmt(sig * sig / n, 3);
    out.innerHTML = 'With n = ' + n + ', the values still spread about <b>' + G.fmt(sd, 1) + '</b> around their mean, close to σ = ' + sig +
      '. Their average is pinned to within about <b>±' + G.fmt(1.96 * se, 2) + '</b> (95%). ' +
      (n < 1600 ? 'Quadruple n to ' + (n * 4 <= 1600 ? n * 4 : '4n') + ' and that window halves to ±' + G.fmt(1.96 * se / 2, 2) + '; the SD does not move.' : 'Every quadrupling of n halved the SE; the SD never moved.');
  }
  G.on([sN, sS], 'input', draw);
  return draw;
});
