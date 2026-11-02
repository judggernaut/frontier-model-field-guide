/* Chapter 36: distillation widgets */
G.widget('w-ds-kd', function (root) {
  var toks = ['Paris', 'located', 'a', 'the', 'Lyon', 'home', 'French', 'banana'];
  var zt = [9.0, 4.2, 3.8, 3.5, 3.0, 2.2, 1.5, -2.0];
  var zs0 = [6.2, 4.9, 4.6, 3.1, 0.8, 3.0, 2.6, 1.2];
  var st = G.$(root, '#ds-t'), sl = G.$(root, '#ds-l'), cv = G.$(root, 'canvas');
  function soft(z, T) { return G.softmax(z.map(function (v) { return v / T; })); }
  function kl(p, q) { var s = 0; for (var i = 0; i < p.length; i++) if (p[i] > 0) s += p[i] * Math.log(p[i] / q[i]); return s; }
  function draw() {
    var P = G.pal(), T = +st.value, lam = +sl.value;
    G.$(root, '#ds-t-o').textContent = G.fmt(T, 2); G.$(root, '#ds-l-o').textContent = G.pct(lam);
    var zs = zs0.map(function (v, i) { return (1 - lam) * v + lam * zt[i]; });
    var pt = soft(zt, T), ps = soft(zs, T);
    var c = G.canvas(cv, 230), ctx = c.ctx, pad = { l: 46, r: 12, t: 14, b: 40 };
    var s = G.axes(ctx, c.w, c.h, pad, { x: [0, toks.length], y: [0, 1], yt: [0, 0.25, 0.5, 0.75, 1], yf: function (v) { return G.pct(v); } });
    var gw = (c.w - pad.l - pad.r) / toks.length, bw = gw * 0.34;
    toks.forEach(function (t, i) {
      var x = s.X(i) + gw / 2;
      ctx.fillStyle = P.accent; ctx.fillRect(x - bw - 1, s.Y(pt[i]), bw, s.Y(0) - s.Y(pt[i]));
      ctx.fillStyle = P.tp; ctx.fillRect(x + 1, s.Y(ps[i]), bw, s.Y(0) - s.Y(ps[i]));
      G.text(ctx, t, x, c.h - pad.b + 14, P.muted, 'center', 12);
    });
    var ent = 0; pt.forEach(function (p) { if (p > 0) ent -= p * Math.log(p); });
    G.$(root, '[data-top]').textContent = G.pct(pt[0], 1);
    G.$(root, '[data-ent]').textContent = G.fmt(ent, 2);
    G.$(root, '[data-fkl]').textContent = G.fmt(kl(pt, ps), 3);
    G.$(root, '[data-rkl]').textContent = G.fmt(kl(ps, pt), 3);
    var msg;
    if (T <= 1.25) msg = 'At T = ' + G.fmt(T, 2) + ' the teacher is almost certain of "Paris", so its soft targets look like a hard label and carry little extra information.';
    else if (T < 4) msg = 'At T = ' + G.fmt(T, 2) + ' the teacher\'s ranking of the wrong answers appears: "located" and "a" are plausible continuations, "Lyon" is a near miss, "banana" is absurd. This is the dark knowledge the student learns from.';
    else msg = 'At very high temperature every option looks similar and the useful contrast fades. Typical distillation temperatures are modest, around 1 to 4.';
    msg += lam < 0.3 ? ' The untrained student puts too much weight on "home" and "French" and too little on "Lyon".' : lam > 0.85 ? ' The student now nearly matches the teacher, so both divergences are close to zero.' : '';
    msg += ' Forward and reverse KL differ because KL is not symmetric.';
    G.$(root, '[data-out]').textContent = msg;
  }
  G.on([st, sl], 'input', draw);
  return draw;
});

G.widget('w-ds-rs', function (root) {
  var sk = G.$(root, '#ds-k'), sm = G.$(root, '#ds-m'), cv = G.$(root, 'canvas'), cb = G.$$(root, '[data-cap] button');
  var cap = 'all', NP = 3000, SCALE = 10000 / NP, cacheM = null, ps = [];
  function gamma(r, a) {
    if (a < 1) return gamma(r, a + 1) * Math.pow(r(), 1 / a);
    var d = a - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      var x = G.gauss(r), v = 1 + c * x; if (v <= 0) continue; v = v * v * v;
      var u = r(); if (u < 1 - 0.0331 * x * x * x * x) return d * v; if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
  function prompts(m) {
    if (cacheM === m) return ps;
    var r = G.rng(11), kappa = 1.3, a = m * kappa, b = (1 - m) * kappa; ps = [];
    for (var i = 0; i < NP; i++) { var x = gamma(r, a), y = gamma(r, b); ps.push(Math.min(0.999, x / (x + y))); }
    ps.sort(function (u, v) { return u - v; }); cacheM = m; return ps;
  }
  function draw() {
    var P = G.pal(), k = +sk.value, m = +sm.value;
    G.$(root, '#ds-k-o').textContent = k; G.$(root, '#ds-m-o').textContent = G.pct(m);
    var p = prompts(m), kept = [], cov = 0, K = 0;
    p.forEach(function (pi) {
      var atLeast = 1 - Math.pow(1 - pi, k);
      var w = cap === 'all' ? k * pi : atLeast;
      kept.push(w); K += w; cov += atLeast;
    });
    var bins = 10, shareP = new Array(bins).fill(0), shareK = new Array(bins).fill(0);
    p.forEach(function (pi, i) { var bI = Math.min(bins - 1, Math.floor(pi * bins)); shareP[bI] += 1 / NP; shareK[bI] += kept[i] / K; });
    var third = Math.floor(NP / 3), hardK = 0; for (var i = 0; i < third; i++) hardK += kept[i];
    var c = G.canvas(cv, 230), ctx = c.ctx, pad = { l: 46, r: 12, t: 14, b: 40 };
    var ymax = Math.max(0.2, Math.ceil(Math.max(Math.max.apply(null, shareP), Math.max.apply(null, shareK)) * 10) / 10);
    var s = G.axes(ctx, c.w, c.h, pad, { x: [0, 1], y: [0, ymax], xt: [0, 0.2, 0.4, 0.6, 0.8, 1], xf: function (v) { return G.pct(v); }, yt: [0, ymax / 2, ymax], yf: function (v) { return G.pct(v); }, xl: 'prompt pass rate (how easy the prompt is for the current model)' });
    var gw = (c.w - pad.l - pad.r) / bins, bw = gw * 0.36;
    for (var bI = 0; bI < bins; bI++) {
      var x = s.X(bI / bins) + gw / 2;
      ctx.fillStyle = P.tn; ctx.fillRect(x - bw - 1, s.Y(shareP[bI]), bw, s.Y(0) - s.Y(shareP[bI]));
      ctx.fillStyle = P.accent; ctx.fillRect(x + 1, s.Y(shareK[bI]), bw, s.Y(0) - s.Y(shareK[bI]));
    }
    G.$(root, '[data-cov]').textContent = G.pct(cov / NP);
    G.$(root, '[data-kept]').textContent = G.big(K * SCALE);
    G.$(root, '[data-cost]').textContent = G.fmt(NP * k / K, 1);
    G.$(root, '[data-hard]').textContent = G.pct(hardK / K);
    var msg = 'The hardest third of prompts makes up ' + G.pct(1 / 3) + ' of the prompt set but only ' + G.pct(hardK / K) + ' of the kept data. ';
    msg += cap === 'all' ? 'Keeping every correct sample lets easy prompts contribute many near-duplicate examples. Try capping at one per prompt.' : 'Capping at one example per prompt flattens the mix, at the price of fewer total examples.';
    msg += ' ' + G.pct(1 - cov / NP) + ' of prompts produce nothing at all with k = ' + k + '; those are exactly the problems the model most needs to learn.';
    G.$(root, '[data-out]').textContent = msg;
  }
  cb.forEach(function (b) { b.addEventListener('click', function () { cap = b.dataset.c; cb.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); draw(); }); });
  G.on([sk, sm], 'input', draw);
  return draw;
});
