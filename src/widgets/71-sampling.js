/* Chapter 71: who ends up in the poll, and the bombers that did not come back */

G.widget('w-sm-poll', function (root) {
  var sm = G.$(root, '#sm-m'), sn = G.$(root, '#sm-n'), on = G.$(root, '#sm-n-o'), bt = G.$(root, '[data-ps]');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  // Illustrative town: four age bands, their population shares and their support for a transit plan.
  var BANDS = ['18–29', '30–44', '45–64', '65+'], PI = [0.20, 0.25, 0.33, 0.22], SUP = [0.72, 0.60, 0.45, 0.35];
  var TRUTH = 0; for (var b0 = 0; b0 < 4; b0++) TRUTH += PI[b0] * SUP[b0];
  var NS = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  // Response propensity for [band][oppose, support]. Random and stratified designs give everyone the same chance.
  var EMAIL = [0.95, 0.85, 0.60, 0.30].map(function (c) { return [c * 0.12, c * 0.12 * 1.2]; });
  var OPTIN = [0.80, 0.45, 0.25, 0.10].map(function (c) { return [c, c * 1.6]; });
  var ONE = [[1, 1], [1, 1], [1, 1], [1, 1]];
  var M = {
    email: { r: EMAIL, label: 'An email poll' },
    srs: { r: ONE, label: 'A simple random sample' },
    strat: { r: ONE, label: 'A stratified sample', strat: true },
    optin: { r: OPTIN, label: 'An opt-in web poll' }
  };
  var ps = false;
  G.on(bt, 'click', function () { ps = !ps; bt.setAttribute('aria-pressed', ps); draw(); });

  // Expected estimate and standard error for a design at sample size n.
  function design(m, n, weight) {
    var r = m.r, w = [], pp = [], tot = 0, b;
    for (b = 0; b < 4; b++) { var x = PI[b] * (SUP[b] * r[b][1] + (1 - SUP[b]) * r[b][0]); w.push(x); tot += x; pp.push(SUP[b] * r[b][1] / (SUP[b] * r[b][1] + (1 - SUP[b]) * r[b][0])); }
    var s = w.map(function (x) { return x / tot; });              // respondents' age mix
    var est, se, neff = n;
    if (m.strat) { s = PI.slice(); }                               // allocation fixed to the population mix
    if (weight || m.strat) {
      est = 0; var v = 0, deff = 0;
      for (b = 0; b < 4; b++) { est += PI[b] * pp[b]; v += PI[b] * PI[b] * pp[b] * (1 - pp[b]) / (n * s[b]); deff += PI[b] * PI[b] / s[b]; }
      se = Math.sqrt(v); neff = n / deff;                          // Kish: weights cost precision
    } else {
      est = 0; for (b = 0; b < 4; b++) est += s[b] * pp[b];
      se = Math.sqrt(est * (1 - est) / n);
    }
    return { est: est, se: se, mix: s, pp: pp, neff: neff, rate: tot };
  }

  function draw() {
    var P = G.pal(), key = sm.value, m = M[key], n = NS[+sn.value], weight = ps && !m.strat;
    on.textContent = n.toLocaleString('en-US');
    bt.disabled = !!m.strat;
    var d = design(m, n, weight);
    var narrow = (cv.parentElement.clientWidth || 640) < 560, H = narrow ? 650 : 352;
    var c = G.canvas(cv, H), ctx = c.ctx;

    // Top or left: the population as dots, grouped by age band.
    var popW = narrow ? c.w : c.w * 0.5, popH = narrow ? 330 : H - 10;
    var counts = PI.map(function (p) { return Math.round(p * 300); });
    var r = G.rng(71), dots = [], b, i;
    for (b = 0; b < 4; b++) for (i = 0; i < counts[b]; i++) dots.push({ b: b, s: r() < SUP[b] ? 1 : 0, u: r() });
    // Highlight 60 dots drawn in proportion to each person's chance of ending up in the sample.
    var take = {}, chosen = 0;
    if (m.strat) {
      for (b = 0; b < 4; b++) { var q = Math.round(60 * PI[b]), ids = []; dots.forEach(function (o, j) { if (o.b === b) ids.push(j); }); ids.sort(function (x, y) { return dots[x].u - dots[y].u; }); ids.slice(0, q).forEach(function (j) { take[j] = 1; }); }
    } else {
      // weighted sampling without replacement: the largest u^(1/w) keys win (Efraimidis-Spirakis)
      var keys = dots.map(function (o, j) { var w = m.r[o.b][o.s]; return { j: j, key: Math.pow(o.u, 1 / w) }; });
      keys.sort(function (x, y) { return y.key - x.key; }); keys.slice(0, 60).forEach(function (e) { take[e.j] = 1; });
    }
    var colW = (popW - 20) / 4, x0 = 10, top = 34, cols = 6, cell = Math.max(7, Math.min(13, (colW - 10) / cols));
    var maxRows = Math.ceil(Math.max.apply(null, counts) / cols), ly = top + maxRows * cell + 14;
    G.text(ctx, 'the town (each dot ≈ 30 people); ringed dots end up in the poll', x0, 12, P.muted, 'left', 11.5);
    var j = 0;
    for (b = 0; b < 4; b++) {
      var bx = x0 + b * colW + (colW - cols * cell) / 2 - 4, idx = 0, nIn = 0, nSup = 0;
      for (i = 0; i < counts[b]; i++, j++) {
        var o = dots[j], cx = bx + 4 + (idx % cols) * cell + cell / 2, cy = top + Math.floor(idx / cols) * cell + cell / 2; idx++;
        var col = o.s ? P.good : P.tn;
        if (take[j]) { nIn++; nSup += o.s; G.dot(ctx, cx, cy, cell * 0.36, col, P.fg); }
        else { ctx.globalAlpha = 0.22; G.dot(ctx, cx, cy, cell * 0.36, col); ctx.globalAlpha = 1; }
      }
      var lx0 = x0 + b * colW + colW / 2, off = Math.abs(d.mix[b] - PI[b]) > 0.04;
      G.text(ctx, BANDS[b], lx0, ly, P.fg, 'center', 12);
      G.text(ctx, 'supports ' + G.pct(SUP[b]), lx0, ly + 15, P.muted, 'center', 11);
      G.text(ctx, 'town ' + G.pct(PI[b]), lx0, ly + 30, P.faint, 'center', 10.5);
      G.text(ctx, 'poll ' + G.pct(d.mix[b]), lx0, ly + 44, off ? P.warn : P.faint, 'center', 10.5);
    }
    var lgY = ly + 64;
    G.dot(ctx, x0 + 6, lgY, 4, P.good); G.text(ctx, 'supports', x0 + 14, lgY, P.muted, 'left', 11);
    G.dot(ctx, x0 + 82, lgY, 4, P.tn); G.text(ctx, 'opposes', x0 + 90, lgY, P.muted, 'left', 11);

    // Bottom or right: estimate against sample size, log scale.
    var gx = narrow ? 0 : popW + 10, gy = narrow ? popH + 16 : 0, gw = narrow ? c.w : c.w - popW - 10, gh = narrow ? H - popH - 16 : H;
    var L = gx + 44, R = gx + gw - 12, T = gy + 28, B = gy + gh - 38;
    var lx = function (v) { return L + (Math.log10(v) - Math.log10(50)) / (Math.log10(100000) - Math.log10(50)) * (R - L); };
    var ly2 = function (v) { return B - (v - 0.3) / (0.55) * (B - T); };
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.fillStyle = P.faint;
    [0.3, 0.4, 0.5, 0.6, 0.7, 0.8].forEach(function (t) { ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(L, ly2(t)); ctx.lineTo(R, ly2(t)); ctx.stroke(); ctx.globalAlpha = 1; G.text(ctx, G.pct(t), L - 6, ly2(t), P.faint, 'right', 11); });
    [100, 1000, 10000, 100000].forEach(function (t) { G.text(ctx, t >= 1000 ? (t / 1000) + 'k' : String(t), lx(t), B + 12, P.faint, 'center', 11); });
    G.text(ctx, 'people in the poll (log scale)', (L + R) / 2, B + 28, P.muted, 'center', 12);
    G.text(ctx, 'estimate of support, with 95% band', L, gy + 12, P.muted, 'left', 11.5);
    // band
    ctx.beginPath(); var up = [], dn = [];
    for (var e = Math.log10(50); e <= 5.0001; e += 0.05) { var nn = Math.pow(10, e), dd = design(m, nn, weight); up.push([lx(nn), ly2(dd.est + 1.96 * dd.se)]); dn.push([lx(nn), ly2(dd.est - 1.96 * dd.se)]); }
    ctx.save(); ctx.beginPath(); ctx.rect(L, T - 6, R - L, B - T + 6); ctx.clip();
    ctx.beginPath(); up.forEach(function (p, q) { q ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); dn.reverse().forEach(function (p) { ctx.lineTo(p[0], p[1]); }); ctx.closePath();
    var biased = Math.abs(d.est - TRUTH) > 0.01, bc = biased ? P.warn : P.accent;
    ctx.fillStyle = bc; ctx.globalAlpha = 0.16; ctx.fill(); ctx.globalAlpha = 1;
    G.line(ctx, [[L, ly2(d.est)], [R, ly2(d.est)]], bc, 2);
    G.line(ctx, [[L, ly2(TRUTH)], [R, ly2(TRUTH)]], P.fg, 1.5, [6, 4]);
    ctx.restore();
    G.text(ctx, 'truth ' + G.pct(TRUTH, 1), R, ly2(TRUTH) + (d.est > TRUTH ? 12 : -12), P.fg, 'right', 11.5);
    // this poll: one simulated result at the chosen n
    var rr = G.rng(1000 + (+sn.value) * 7 + key.length * 131 + (weight ? 3 : 0)), got = d.est + d.se * G.gauss(rr);
    var px = lx(n);
    G.line(ctx, [[px, ly2(got - 1.96 * d.se)], [px, ly2(got + 1.96 * d.se)]], P.fg, 2);
    G.dot(ctx, px, ly2(got), 5, bc, P.surface);

    var hit = Math.abs(got - TRUTH) <= 1.96 * d.se;
    k('truth').textContent = G.pct(TRUTH, 1);
    k('est').textContent = G.pct(got, 1) + ' ± ' + G.fmt(196 * d.se, 1);
    k('bias').textContent = (d.est - TRUTH >= 0 ? '+' : '') + G.fmt((d.est - TRUTH) * 100, 1) + ' pts';
    k('neff').textContent = G.big(Math.round(d.neff));
    var txt = m.label + (weight ? ', post-stratified by age,' : '') + ' of ' + n.toLocaleString('en-US') + ' people says <b>' + G.pct(got, 1) + '</b> (±' + G.fmt(196 * d.se, 1) + ' points). The truth is ' + G.pct(TRUTH, 1) + '. ';
    if (biased) {
      txt += 'The design is off by <b>' + G.fmt((d.est - TRUTH) * 100, 1) + ' points</b> on average, and that number does not change with n: more people only shrink the band around the wrong value. ' + (hit ? 'This particular interval still covers the truth, by luck and width.' : 'This interval <b>misses the truth</b>.');
      if (key !== 'srs' && !weight) txt += ' Try post-stratifying: it fixes the part of the bias that comes from the wrong age mix.';
      if (weight) txt += ' Weighting fixed the age mix, but within each band supporters were still likelier to answer, and no age weight can see that.';
    } else {
      txt += 'Every person had a known, equal chance of selection, so the band is centred on the truth and shrinks like 1/√n.' + (m.strat ? ' Fixing each band\'s share also trims the band slightly compared with a simple random sample.' : '');
    }
    out.innerHTML = txt;
  }
  G.on(sm, 'change', draw); G.on(sn, 'input', draw);
  return draw;
});

/* Plane geometry shared by the widget: unit square, nose at the top. */
var SM_PLANE = (function () {
  function rect(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  return [
    { name: 'Engines', kill: null, polys: [rect(0.155, 0.34, 0.215, 0.50), rect(0.315, 0.31, 0.375, 0.48), rect(0.625, 0.31, 0.685, 0.48), rect(0.785, 0.34, 0.845, 0.50)] },
    { name: 'Cockpit', kill: 0.45, polys: [[[0.5, 0.04], [0.545, 0.10], [0.545, 0.25], [0.455, 0.25], [0.455, 0.10]]] },
    { name: 'Tail', kill: 0.12, polys: [rect(0.455, 0.80, 0.545, 0.96), [[0.455, 0.84], [0.30, 0.90], [0.30, 0.94], [0.455, 0.93]], [[0.545, 0.84], [0.70, 0.90], [0.70, 0.94], [0.545, 0.93]]] },
    { name: 'Fuselage', kill: 0.05, polys: [rect(0.455, 0.25, 0.545, 0.80)] },
    { name: 'Wings', kill: 0.06, polys: [[[0.455, 0.37], [0.04, 0.47], [0.04, 0.53], [0.455, 0.51]], [[0.545, 0.37], [0.96, 0.47], [0.96, 0.53], [0.545, 0.51]]] }
  ];
})();
function smInPoly(p, poly) {
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function smSection(p) {
  for (var s = 0; s < SM_PLANE.length; s++) for (var q = 0; q < SM_PLANE[s].polys.length; q++) if (smInPoly(p, SM_PLANE[s].polys[q])) return s;
  return -1;
}

G.widget('w-sm-planes', function (root) {
  var sn = G.$(root, '#sm-sorties'), se = G.$(root, '#sm-eng'), on = G.$(root, '#sm-sorties-o'), oe = G.$(root, '#sm-eng-o');
  var bt = G.$(root, '[data-lost]'), cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  var show = false;
  G.on(bt, 'click', function () { show = !show; bt.setAttribute('aria-pressed', show); draw(); });
  // Section areas, measured once on a grid.
  var area = SM_PLANE.map(function () { return 0; }), tot = 0;
  for (var gx = 0; gx < 160; gx++) for (var gy = 0; gy < 160; gy++) { var s0 = smSection([(gx + 0.5) / 160, (gy + 0.5) / 160]); if (s0 >= 0) { area[s0]++; tot++; } }
  area = area.map(function (a) { return a / tot; });

  function draw() {
    var P = G.pal(), N = +sn.value, ke = +se.value / 100;
    on.textContent = N; oe.textContent = G.pct(ke);
    var kill = SM_PLANE.map(function (s) { return s.kill === null ? ke : s.kill; });
    // Fly the sorties: each plane takes 1 to 5 hits spread evenly over its surface.
    var r = G.rng(1943), hitsBack = [], hitsLost = [], back = 0, cntBack = area.map(function () { return 0; }), cntAll = area.map(function () { return 0; });
    for (var p = 0; p < N; p++) {
      var nh = 1 + Math.floor(r() * 5), hs = [], down = false;
      while (hs.length < nh) { var pt = [r(), r()], s = smSection(pt); if (s < 0) continue; hs.push({ p: pt, s: s }); if (r() < kill[s]) down = true; }
      hs.forEach(function (h) { cntAll[h.s]++; if (!down) cntBack[h.s]++; (down ? hitsLost : hitsBack).push(h); });
      if (!down) back++;
    }
    var narrow = (cv.parentElement.clientWidth || 640) < 560, H = narrow ? 560 : 330;
    var c = G.canvas(cv, H), ctx = c.ctx;
    var S = narrow ? Math.min(c.w - 20, 300) : Math.min(c.w * 0.5, H - 30), ox = narrow ? (c.w - S) / 2 : 10, oy = 22;
    var X = function (u) { return ox + u * S; }, Y = function (v) { return oy + v * S; };
    G.text(ctx, show ? 'all holes: returned planes and lost planes' : 'holes on the ' + back + ' planes that came back', ox, 10, P.muted, 'left', 11.5);
    SM_PLANE.slice().reverse().forEach(function (sec) {
      sec.polys.forEach(function (poly) {
        ctx.beginPath(); poly.forEach(function (q, i) { i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1])); }); ctx.closePath();
        ctx.fillStyle = P.sunk; ctx.fill(); ctx.strokeStyle = P.faint; ctx.lineWidth = 1; ctx.stroke();
      });
    });
    var dr = Math.max(1.6, S / 150);
    if (show) hitsLost.forEach(function (h) { G.dot(ctx, X(h.p[0]), Y(h.p[1]), dr, P.warn); });
    hitsBack.forEach(function (h) { G.dot(ctx, X(h.p[0]), Y(h.p[1]), dr, P.accent); });

    // Bars: holes per unit area, relative to the plane-wide average.
    var bx0 = narrow ? 92 : ox + S + 104, bx1 = c.w - 44, by0 = narrow ? oy + S + 34 : 40, rowH = narrow ? 34 : Math.min(48, (H - 70) / 5);
    var totB = G.sum(cntBack) || 1, totA = G.sum(cntAll) || 1;
    var dB = cntBack.map(function (v, i) { return (v / totB) / area[i]; }), dA = cntAll.map(function (v, i) { return (v / totA) / area[i]; });
    var mx = Math.max(2, Math.max.apply(null, dB.concat(show ? dA : [])));
    G.text(ctx, 'holes per unit area (1 = plane average)', bx0 - 80, by0 - 16, P.muted, 'left', 11.5);
    var XB = function (v) { return bx0 + v / mx * (bx1 - bx0); };
    SM_PLANE.forEach(function (sec, i) {
      var y = by0 + i * rowH;
      G.text(ctx, sec.name, bx0 - 8, y + 9, P.fg, 'right', 12);
      ctx.fillStyle = P.accent; ctx.fillRect(bx0, y + 2, XB(dB[i]) - bx0, 10);
      G.text(ctx, G.fmt(dB[i], 2), XB(dB[i]) + 5, y + 7, P.accent, 'left', 11);
      if (show) { ctx.fillStyle = P.warn; ctx.fillRect(bx0, y + 15, XB(dA[i]) - bx0, 10); G.text(ctx, G.fmt(dA[i], 2), XB(dA[i]) + 5, y + 20, P.warn, 'left', 11); }
    });
    G.line(ctx, [[XB(1), by0 - 4], [XB(1), by0 + 5 * rowH - 6]], P.faint, 1, [3, 3]);
    var lgy = by0 + 5 * rowH + 6;
    G.dot(ctx, bx0 - 74, lgy, 4, P.accent); G.text(ctx, 'came back', bx0 - 66, lgy, P.muted, 'left', 11);
    if (show) { G.dot(ctx, bx0 + 14, lgy, 4, P.warn); G.text(ctx, 'all planes', bx0 + 22, lgy, P.muted, 'left', 11); }

    var worst = 0; dB.forEach(function (v, i) { if (v < dB[worst]) worst = i; });
    k('back').textContent = back + ' of ' + N;
    k('eng').textContent = G.fmt(dB[0], 2);
    k('fus').textContent = G.fmt(dB[3], 2);
    k('worst').textContent = SM_PLANE[worst].name;
    out.innerHTML = 'Hits land evenly over the plane, so if every plane came back each section would show about 1 hole per unit area. Among the planes that returned, engines show <b>' + G.fmt(dB[0], 2) + '</b> and the fuselage <b>' + G.fmt(dB[3], 2) + '</b>. ' +
      (show ? 'Counting the lost planes too, every section is close to 1 again: the "missing" engine holes were on the planes that never came home. '
        : 'The fuselage looks like the place that takes the punishment. Reveal the planes that did not return to see why that reading is backwards. ') +
      'The section with the fewest holes per area among survivors, <b>' + SM_PLANE[worst].name.toLowerCase() + '</b>, is where a hit is most often fatal.';
  }
  G.on([sn, se], 'input', draw);
  return draw;
});
