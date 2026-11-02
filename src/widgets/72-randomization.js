/* Chapter 72: assignment simulator and a difference-in-differences explorer. */
function rzNice(lo, hi, n) {
  var span = hi - lo, raw = span / (n || 6), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  var step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag, t = [], v = Math.ceil(lo / step) * step;
  for (; v <= hi + 1e-9; v += step) t.push(Math.round(v * 1e6) / 1e6);
  return t;
}
function rzSd(a) { var m = G.mean(a), s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return a.length > 1 ? Math.sqrt(s / (a.length - 1)) : 0; }

G.widget('w-rz-sim', function (root) {
  var st = { rule: 'optin', est: 'after' };
  var sE = G.$(root, '#rz-eff'), sN = G.$(root, '#rz-n'), oE = G.$(root, '#rz-eff-o'), oN = G.$(root, '#rz-n-o');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]'), bal = G.$(root, '[data-bal]');
  var k = function (n) { return G.$(root, '[data-k2=' + n + ']'); };
  var NS = [100, 200, 400, 800, 1600, 3200], RUNS = 300, SHIFT = [0.45, 0.15, -0.15, -0.45];
  var NAMES = { random: 'coin flip', optin: 'opt-in', lowest: 'treat-the-lowest-scorers', region: 'one-region pilot' };

  function experiment(r, n, tau, rule) {
    var reg = [], m = [], pre = [], post = [], age = [], T = [], i;
    for (i = 0; i < n; i++) {
      var g = Math.floor(r() * 4), mi = SHIFT[g] + 0.9 * G.gauss(r);
      reg.push(g); m.push(mi); age.push(1 + 35 * r());
      pre.push(50 + 8 * mi + 6 * G.gauss(r));
      post.push(50 + 8 * mi + 1.5 + 1.5 * mi + 6 * G.gauss(r));   // shared time trend; motivated users also grow faster
    }
    var med = pre.slice().sort(function (a, b) { return a - b; })[Math.floor(n / 2)];
    for (i = 0; i < n; i++) {
      var t;
      if (rule === 'random') t = r() < 0.5;
      else if (rule === 'optin') t = r() < G.sigmoid(-0.2 + 1.8 * m[i]);
      else if (rule === 'lowest') t = pre[i] < med;
      else t = reg[i] === 0;
      T.push(t ? 1 : 0);
      if (t) post[i] += tau;
    }
    return { m: m, pre: pre, post: post, age: age, T: T, n: n };
  }
  function split(e, f) {
    var a = [], b = [];
    for (var i = 0; i < e.n; i++) (e.T[i] ? a : b).push(f(i));
    return [a, b];
  }
  function estimate(e, est) {
    var p;
    if (est === 'after') p = split(e, function (i) { return e.post[i]; });
    else p = split(e, function (i) { return e.post[i] - e.pre[i]; });
    var a = p[0], b = p[1];
    if (a.length < 2 || b.length < 2) return null;
    if (est === 'prepost') return { est: G.mean(a), se: rzSd(a) / Math.sqrt(a.length) };
    var va = rzSd(a), vb = rzSd(b);
    return { est: G.mean(a) - G.mean(b), se: Math.sqrt(va * va / a.length + vb * vb / b.length) };
  }
  function smd(a, b) { var s = Math.sqrt((Math.pow(rzSd(a), 2) + Math.pow(rzSd(b), 2)) / 2); return s > 0 ? (G.mean(a) - G.mean(b)) / s : NaN; }

  function draw() {
    var P = G.pal(), tau = +sE.value, n = NS[+sN.value];
    oE.textContent = G.fmt(tau, 1); oN.textContent = n;
    var r = G.rng(72), ests = [], miss = 0, first = null, smdAcc = [0, 0, 0], smdCnt = 0;
    for (var j = 0; j < RUNS; j++) {
      var e = experiment(r, n, tau, st.rule), x = estimate(e, st.est);
      if (!x) continue;
      ests.push(x.est);
      if (Math.abs(x.est - tau) > 1.96 * x.se) miss++;
      var vars = [function (i) { return e.m[i]; }, function (i) { return e.pre[i]; }, function (i) { return e.age[i]; }];
      var row = vars.map(function (f) { var p = split(e, f); return { t: G.mean(p[0]), c: G.mean(p[1]), d: smd(p[0], p[1]) }; });
      row.forEach(function (q, qi) { smdAcc[qi] += Math.abs(q.d); });
      smdCnt++;
      if (!first) first = row;
    }
    var avg = G.mean(ests), sd = rzSd(ests), bias = avg - tau;
    // histogram
    var lo = Math.min(tau, ests.reduce(function (a, b) { return Math.min(a, b); }, Infinity)),
        hi = Math.max(tau, ests.reduce(function (a, b) { return Math.max(a, b); }, -Infinity));
    var padv = Math.max(1, (hi - lo) * 0.08); lo -= padv; hi += padv;
    var NB = 40, bw = (hi - lo) / NB, bins = new Array(NB).fill(0);
    ests.forEach(function (v) { bins[Math.min(NB - 1, Math.floor((v - lo) / bw))]++; });
    var ymax = Math.max.apply(null, bins) * 1.25;
    var c = G.canvas(cv, 250), ctx = c.ctx, pad = { l: 40, r: 16, t: 30, b: 36 };
    var ax = G.axes(ctx, c.w, c.h, pad, { x: [lo, hi], y: [0, ymax], xt: rzNice(lo, hi, c.w < 500 ? 4 : 7), yt: [], xl: 'estimated effect (score points), one bar = runs landing in that range' });
    ctx.globalAlpha = 0.8;
    bins.forEach(function (b, i) {
      if (!b) return;
      var x0 = ax.X(lo + i * bw), x1 = ax.X(lo + (i + 1) * bw);
      ctx.fillStyle = P.accent; ctx.fillRect(x0 + 0.5, ax.Y(b), Math.max(1, x1 - x0 - 1), ax.Y(0) - ax.Y(b));
    });
    ctx.globalAlpha = 1;
    var big = Math.abs(bias) > Math.max(0.3, 0.25 * sd);
    G.line(ctx, [[ax.X(tau), pad.t - 6], [ax.X(tau), c.h - pad.b]], P.good, 2.5);
    G.line(ctx, [[ax.X(avg), pad.t + 8], [ax.X(avg), c.h - pad.b]], big ? P.fp : P.fg, 2, [5, 4]);
    var leftT = ax.X(tau) > c.w - 140, leftA = ax.X(avg) > c.w - 160;
    G.text(ctx, 'true effect ' + G.fmt(tau, 1), ax.X(tau) + (leftT ? -6 : 6), pad.t - 12, P.good, leftT ? 'right' : 'left', 12);
    if (Math.abs(ax.X(avg) - ax.X(tau)) > 4) G.text(ctx, 'average estimate ' + G.fmt(avg, 1), ax.X(avg) + (leftA ? -6 : 6), pad.t + 10, big ? P.fp : P.fg, leftA ? 'right' : 'left', 12);
    k('true').textContent = G.fmt(tau, 1); k('avg').textContent = G.fmt(avg, 2);
    k('bias').textContent = (bias > 0 ? '+' : '') + G.fmt(bias, 2); k('bias').style.color = big ? 'var(--fp)' : 'var(--good)';
    k('sd').textContent = G.fmt(sd, 2);
    var mr = miss / ests.length; k('miss').textContent = G.pct(mr, 0); k('miss').style.color = mr > 0.1 ? 'var(--fp)' : 'var(--good)';
    // balance table
    var labels = ['Motivation (hidden, never measured)', 'Pre-period score (measured)', 'Account age, months (measured)'];
    bal.innerHTML = first.map(function (q, qi) {
      var typ = smdAcc[qi] / smdCnt, flag = Math.abs(q.d) > 0.1;
      return '<tr><td>' + labels[qi] + '</td><td class="n">' + G.fmt(q.t, qi ? 1 : 2) + '</td><td class="n">' + G.fmt(q.c, qi ? 1 : 2) +
        '</td><td class="n" style="color:' + (flag ? 'var(--fp)' : 'var(--good)') + '">' + G.fmt(q.d, 2) + '</td><td class="n">' + G.fmt(typ, 2) + '</td></tr>';
    }).join('');
    // readout
    var msg = 'With the ' + NAMES[st.rule] + ' rule and ';
    msg += st.est === 'after' ? 'a straight treated-versus-control comparison' : st.est === 'prepost' ? 'a before-versus-after comparison of the treated group' : 'a change-versus-change (difference-in-differences) comparison';
    msg += ', the 300 estimates centre on <b>' + G.fmt(avg, 1) + '</b> against a true effect of <b>' + G.fmt(tau, 1) + '</b>. ';
    if (!big) msg += 'That is unbiased: individual runs scatter by about ±' + G.fmt(1.96 * sd, 1) + ', and more users would tighten the scatter around the truth. ';
    else msg += 'The bias of <b>' + (bias > 0 ? '+' : '') + G.fmt(bias, 1) + '</b> does not shrink with more users; try raising the sample size and watch the spread tighten around the wrong value. ';
    if (st.rule === 'optin' && st.est === 'after') msg += 'Motivated users opt in, and motivation raises scores on its own. The balance table shows it in the hidden trait, and the pre-period score betrays it too.';
    else if (st.rule === 'optin' && st.est === 'did') msg += 'Comparing changes removes most of the stable motivation gap, but motivated users also improve faster, so trends are not parallel and some bias remains.';
    else if (st.rule === 'lowest' && st.est === 'prepost') msg += 'This is regression to the mean: users picked for a low pre-period score were partly unlucky, so they bounce back even without treatment. The shared time trend adds a little more.';
    else if (st.rule === 'lowest' && st.est === 'did') msg += 'Selecting on the pre-period outcome breaks difference-in-differences: the treated group bounces up and the control group drifts down, both by chance.';
    else if (st.rule === 'lowest') msg += 'The treated group is the less motivated half, so after treatment it still trails the rest. The effect looks negative or small.';
    else if (st.rule === 'region') msg += 'The pilot region happens to have more motivated users, and the account-age row stays balanced, which shows a balance table only checks what you measured.';
    else if (st.est === 'prepost') msg += 'Even with a coin flip, before-versus-after credits the treatment with the shared time trend of 1.5 points plus motivated growth. A control group removes it.';
    else msg += 'A coin flip balances the hidden trait on average; any single run can be off, and the interval accounts for that. About 5% of 95% intervals should miss.';
    out.innerHTML = msg;
  }
  G.$$(root, '[data-k]').forEach(function (g) {
    var key = g.dataset.k, bs = G.$$(g, 'button');
    bs.forEach(function (b) {
      G.on(b, 'click', function () { st[key] = b.dataset.v; bs.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); draw(); });
    });
  });
  G.on([sE, sN], 'input', draw);
  return draw;
});

G.widget('w-rz-did', function (root) {
  var sT = G.$(root, '#rz-did-eff'), sG = G.$(root, '#rz-did-g'), sS = G.$(root, '#rz-did-s');
  var oT = G.$(root, '#rz-did-eff-o'), oG = G.$(root, '#rz-did-g-o'), oS = G.$(root, '#rz-did-s-o');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]'), k = function (n) { return G.$(root, '[data-k2=' + n + ']'); };
  var W = 10, L = 5;   // weeks, launch after week 5
  var r = G.rng(7), NC = [], NT = [];
  for (var i = 0; i < W; i++) { NC.push(1.2 * G.gauss(r)); NT.push(1.2 * G.gauss(r)); }
  function draw() {
    var P = G.pal(), tau = +sT.value, g = +sG.value, sh = +sS.value;
    oT.textContent = tau; oG.textContent = G.fmt(g, 2); oS.textContent = sh;
    var C = [], T = [], CF = [], i;
    for (i = 0; i < W; i++) {
      var t = i + 1, post = t > L;
      C.push(100 + 3 * t + NC[i]);
      var base = 112 + 3 * t + g * (t - L) + (post ? sh : 0) + NT[i];
      CF.push(base); T.push(base + (post ? tau : 0));
    }
    function mean(a, from, to) { var s = 0; for (var j = from; j < to; j++) s += a[j]; return s / (to - from); }
    var did = (mean(T, L, W) - mean(T, 0, L)) - (mean(C, L, W) - mean(C, 0, L)), bias = did - tau;
    // pre-trend: slope of (T - C) on week over weeks 1..5
    var xs = [], ys = [];
    for (i = 0; i < L; i++) { xs.push(i + 1); ys.push(T[i] - C[i]); }
    var mx = G.mean(xs), my = G.mean(ys), sxy = 0, sxx = 0;
    for (i = 0; i < L; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
    var slope = sxy / sxx, flagged = Math.abs(slope) > 0.8;
    // DiD's implied counterfactual: treated pre level plus the control group's change
    var preGap = mean(T, 0, L) - mean(C, 0, L), DC = C.map(function (v) { return v + preGap; });
    var all = C.concat(T, CF, DC), lo = Math.min.apply(null, all) - 4, hi = Math.max.apply(null, all) + 6;
    var c = G.canvas(cv, 270), ctx = c.ctx, pad = { l: 44, r: c.w < 520 ? 16 : 150, t: 16, b: 36 };
    var ax = G.axes(ctx, c.w, c.h, pad, { x: [0.6, W + 0.4], y: [lo, hi], xt: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], yt: rzNice(lo, hi, 5), xl: 'week', yl: 'daily metric' });
    ctx.fillStyle = P.sunk; ctx.globalAlpha = 0.5; ctx.fillRect(ax.X(L + 0.5), pad.t, ax.X(W + 0.4) - ax.X(L + 0.5), c.h - pad.t - pad.b); ctx.globalAlpha = 1;
    G.text(ctx, 'after launch', ax.X(L + 0.5) + 6, pad.t + 10, P.muted, 'left', 11.5);
    function pts(a, from, to) { var p = []; for (var j = from; j < to; j++) p.push([ax.X(j + 1), ax.Y(a[j])]); return p; }
    G.line(ctx, pts(DC, L - 1, W), P.accent, 1.8, [6, 5]);
    G.line(ctx, pts(CF, L - 1, W), P.fn, 1.8, [2, 4]);
    G.line(ctx, pts(C, 0, W), P.tn, 2.5);
    G.line(ctx, pts(T, 0, W), P.accent, 2.5);
    for (i = 0; i < W; i++) { G.dot(ctx, ax.X(i + 1), ax.Y(C[i]), 3.2, P.tn); G.dot(ctx, ax.X(i + 1), ax.Y(T[i]), 3.2, P.accent); }
    var wide = c.w >= 520, lx = ax.X(W) + 10, ends = [[T[W - 1], 'treated', P.accent], [DC[W - 1], 'DiD assumes', P.accent], [CF[W - 1], 'true no-treatment path', P.fn], [C[W - 1], 'control', P.muted]];
    if (wide) {
      ends.sort(function (a, b) { return b[0] - a[0]; });
      var lastY = -1e9;
      ends.forEach(function (e) { var y = Math.max(ax.Y(e[0]), lastY + 15); lastY = y; G.text(ctx, e[1], lx, y, e[2], 'left', 11.5); });
    } else {
      G.text(ctx, '— treated   — control   - - DiD assumes   ··· truth', pad.l + 6, c.h - pad.b - 10, P.muted, 'left', 11);
    }
    k('true').textContent = G.fmt(tau, 1); k('did').textContent = G.fmt(did, 1);
    k('bias').textContent = (bias > 0 ? '+' : '') + G.fmt(bias, 1); k('bias').style.color = Math.abs(bias) > 1.5 ? 'var(--fp)' : 'var(--good)';
    k('pre').textContent = (slope > 0 ? '+' : '') + G.fmt(slope, 2) + (flagged ? ' ✗' : ' ✓'); k('pre').style.color = flagged ? 'var(--fp)' : 'var(--good)';
    var msg = 'DiD estimates <b>' + G.fmt(did, 1) + '</b> against a true effect of <b>' + G.fmt(tau, 1) + '</b>. ';
    if (Math.abs(g) < 0.01 && sh === 0) msg += 'Both groups share a trend before launch, so the dashed path DiD assumes matches the true no-treatment path, and the only error is week-to-week noise.';
    else {
      if (Math.abs(g) >= 0.01) msg += 'The treated group was already drifting ' + G.fmt(Math.abs(g), 2) + ' per week ' + (g > 0 ? 'up' : 'down') + ' relative to control, which adds about ' + G.fmt(5 * g, 1) + ' to the estimate. ' + (flagged ? 'The pre-trend check catches it: the gap between the groups was not flat before launch. ' : 'The drift is small enough to hide in the noise of five pre-launch weeks. ');
      if (sh !== 0) msg += 'The launch-week shock of ' + (sh > 0 ? '+' : '') + sh + ' is credited to the treatment in full, and no pre-trend check can see it, because it starts exactly at launch. Only knowledge of what else happened that week, or a second comparison group, can rule it out.';
    }
    out.innerHTML = msg;
  }
  G.on([sT, sG, sS], 'input', draw);
  return draw;
});
