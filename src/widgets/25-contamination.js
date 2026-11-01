/* Contamination as a measurable gap: original vs perturbed items, suspect model vs clean control. */
G.widget('w-ct-perturb', function (root) {
  var sn = G.$(root, '#ct-n'), sc = G.$(root, '#ct-c'), sm = G.$(root, '#ct-m'), sd = G.$(root, '#ct-d');
  var on = G.$(root, '#ct-n-o'), oc = G.$(root, '#ct-c-o'), om = G.$(root, '#ct-m-o'), od = G.$(root, '#ct-d-o');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  function wilson(k, n) {
    if (!n) return [0, 1];
    var z = 1.96, p = k / n, den = 1 + z * z / n, cen = (p + z * z / (2 * n)) / den;
    var h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
    return [Math.max(0, cen - h), Math.min(1, cen + h)];
  }
  function meanSe(a) {
    var m = G.mean(a), v = 0;
    for (var i = 0; i < a.length; i++) v += (a[i] - m) * (a[i] - m);
    v = a.length > 1 ? v / (a.length - 1) : 0;
    return [m, Math.sqrt(v / a.length)];
  }
  function draw() {
    var n = +sn.value, c = +sc.value, m = +sm.value, d = +sd.value, p = 0.55;
    on.textContent = n; oc.textContent = G.pct(c); om.textContent = G.fmt(m, 2); od.textContent = G.fmt(d * 100, 0) + ' pts';
    var r = G.rng(91);
    var so = 0, sp = 0, co = 0, cp = 0, dS = [], dC = [], dd = [];
    for (var i = 0; i < n; i++) {
      var diff = r() - 0.5;                       // item difficulty jitter, shared by both models
      var base = Math.min(0.98, Math.max(0.02, p + 0.5 * diff));
      var seen = r() < c;                          // item text was in the suspect model's training data
      // A model that solves an item usually solves its rewording too: the perturbed draw
      // reuses the original draw 75% of the time. Shared draws across models make it paired.
      var u1 = r(), u2 = r() < 0.75 ? u1 : r();
      // suspect model: memorisation lifts accuracy on seen items, but only in their original wording
      var pOrig = seen ? base + m * (1 - base) : base;
      var pPert = Math.max(0, base - d);
      // the suspect is a different model: it shares 60% of its item-level luck with the control
      var v1 = r() < 0.6 ? u1 : r(), v2 = r() < 0.75 ? v1 : r();
      var a1 = v1 < pOrig ? 1 : 0, a2 = v2 < pPert ? 1 : 0;
      // clean control: same capability, never saw the items
      var b1 = u1 < base ? 1 : 0, b2 = u2 < Math.max(0, base - d) ? 1 : 0;
      so += a1; sp += a2; co += b1; cp += b2;
      dS.push(a1 - a2); dC.push(b1 - b2); dd.push((a1 - a2) - (b1 - b2));
    }
    var gS = meanSe(dS), gC = meanSe(dC), gD = meanSe(dd);
    var P = G.pal(), cnv = G.canvas(cv, 240), ctx = cnv.ctx, pad = { l: 46, r: 14, t: 18, b: 40 };
    var s = G.axes(ctx, cnv.w, cnv.h, pad, { x: [0, 5], y: [0, 1], yt: [0, 0.25, 0.5, 0.75, 1], yf: function (t) { return G.pct(t); }, yl: 'accuracy' });
    var bars = [
      { x: 0.7, k: so, col: P.fp, lab: 'original' }, { x: 1.7, k: sp, col: P.roc, lab: 'perturbed' },
      { x: 3.3, k: co, col: P.tn, lab: 'original' }, { x: 4.3, k: cp, col: P.roc, lab: 'perturbed' }];
    var bw = (s.X(1) - s.X(0)) * 0.62;
    bars.forEach(function (b) {
      var acc = b.k / n, ci = wilson(b.k, n), x = s.X(b.x);
      ctx.fillStyle = b.col; ctx.globalAlpha = 0.85; ctx.fillRect(x - bw / 2, s.Y(acc), bw, s.Y(0) - s.Y(acc)); ctx.globalAlpha = 1;
      G.line(ctx, [[x, s.Y(ci[0])], [x, s.Y(ci[1])]], P.fg, 1.5);
      G.line(ctx, [[x - 6, s.Y(ci[0])], [x + 6, s.Y(ci[0])]], P.fg, 1.5);
      G.line(ctx, [[x - 6, s.Y(ci[1])], [x + 6, s.Y(ci[1])]], P.fg, 1.5);
      G.text(ctx, G.pct(acc), x, s.Y(ci[1]) - 9, P.fg, 'center', 12);
      G.text(ctx, b.lab, x, cnv.h - pad.b + 12, P.muted, 'center', 11);
    });
    G.text(ctx, 'Suspect model', s.X(1.2), cnv.h - 8, P.fg, 'center', 12);
    G.text(ctx, 'Clean control', s.X(3.8), cnv.h - 8, P.fg, 'center', 12);
    var lo = gD[0] - 1.96 * gD[1], hi = gD[0] + 1.96 * gD[1];
    var verdict = lo > 0
      ? '<b style="color:var(--warn)">Contamination signal.</b> The suspect model loses more on rewording than the clean control does, and the interval excludes zero.'
      : '<span style="color:var(--good)"><b>No detectable signal at this sample size.</b></span> That is not proof of a clean benchmark; it means this test could not separate the two at n = ' + n + '.';
    out.innerHTML =
      'Suspect model drop on rewording: <b>' + G.fmt(gS[0] * 100, 1) + ' pts</b> (±' + G.fmt(1.96 * gS[1] * 100, 1) + ').<br>' +
      'Clean control drop (perturbation difficulty alone): <b>' + G.fmt(gC[0] * 100, 1) + ' pts</b> (±' + G.fmt(1.96 * gC[1] * 100, 1) + ').<br>' +
      'Difference in differences: <b>' + G.fmt(gD[0] * 100, 1) + ' pts</b>, 95% CI [' + G.fmt(lo * 100, 1) + ', ' + G.fmt(hi * 100, 1) + '].<br>' + verdict +
      '<br><span class="muted">Estimated memorisation share of the headline score: ' + G.fmt(Math.max(0, gD[0]) * 100, 1) + ' of ' + G.fmt(so / n * 100, 1) + ' points.</span>';
  }
  G.on([sn, sc, sm, sd], 'input', draw);
  return draw;
});
