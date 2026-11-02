/* Inference chapter widgets: decoding explorer, best-of-N vs majority vote, KV-cache calculator. */
G.widget('w-in-decode', function (root) {
  var toks = [' sunny', ' nice', ' cold', ' warm', ' beautiful', ' hot', ' cloudy', ' rainy', ' perfect', ' terrible', ' unpredictable', ' purple'];
  var logits = [3.2, 2.9, 2.5, 2.3, 2.0, 1.6, 1.5, 1.3, 0.9, 0.4, -0.2, -2.0];
  var st = G.$(root, '#in-t'), sk = G.$(root, '#in-k'), sp = G.$(root, '#in-p'), sm = G.$(root, '#in-m');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var presets = { greedy: [0.05, 1, 1, 0], chat: [0.7, 12, 0.9, 0], eval: [1, 12, 0.95, 0], reset: [1, 12, 1, 0] };
  G.$$(root, 'button[data-preset]').forEach(function (b) {
    b.addEventListener('click', function () { var v = presets[b.dataset.preset]; st.value = v[0]; sk.value = v[1]; sp.value = v[2]; sm.value = v[3]; draw(); });
  });
  function norm(p, keep) { var s = 0; p.forEach(function (v, i) { if (keep[i]) s += v; }); return p.map(function (v, i) { return keep[i] ? v / s : 0; }); }
  function draw() {
    var T = +st.value, K = +sk.value, Pp = +sp.value, M = +sm.value;
    G.$(root, '#in-t-o').textContent = G.fmt(T, 2); G.$(root, '#in-k-o').textContent = K;
    G.$(root, '#in-p-o').textContent = G.fmt(Pp, 2); G.$(root, '#in-m-o').textContent = G.fmt(M, 2);
    var base = G.softmax(logits.map(function (z) { return z / T; }));
    var order = base.map(function (v, i) { return i; }).sort(function (a, b) { return base[b] - base[a]; });
    var keep = base.map(function () { return true; }), cut = base.map(function () { return ''; });
    order.forEach(function (i, r) { if (r >= K) { keep[i] = false; cut[i] = 'top-k'; } });
    var p = norm(base, keep), cum = 0, reached = false;
    order.forEach(function (i) { if (!keep[i]) return; if (reached) { keep[i] = false; cut[i] = 'top-p'; return; } cum += p[i]; if (cum >= Pp - 1e-12) reached = true; });
    p = norm(base, keep);
    var mx = Math.max.apply(null, p);
    p.forEach(function (v, i) { if (keep[i] && v < M * mx) { keep[i] = false; cut[i] = 'min-p'; } });
    var fin = norm(base, keep);
    var P = G.pal(), rowH = 22, c = G.canvas(cv, toks.length * rowH + 34), ctx = c.ctx, lab = 112, right = 56;
    var W = c.w - lab - right, maxv = Math.max(Math.max.apply(null, base), Math.max.apply(null, fin), 0.05);
    order.forEach(function (i, r) {
      var y = 8 + r * rowH;
      G.text(ctx, toks[i].trim(), lab - 8, y + rowH / 2 - 2, keep[i] ? P.fg : P.faint, 'right', 12.5);
      ctx.fillStyle = P.sunk; ctx.fillRect(lab, y + 3, W, rowH - 8);
      ctx.fillStyle = P.tn; ctx.globalAlpha = 0.45; ctx.fillRect(lab, y + 3, W * base[i] / maxv, rowH - 8); ctx.globalAlpha = 1;
      if (keep[i]) { ctx.fillStyle = P.accent; ctx.fillRect(lab, y + 6, W * fin[i] / maxv, rowH - 14); }
      G.text(ctx, keep[i] ? G.pct(fin[i], fin[i] < 0.1 ? 1 : 0) : cut[i], lab + W + 6, y + rowH / 2 - 2, keep[i] ? P.fg : P.faint, 'left', 11.5);
    });
    G.text(ctx, 'grey: after temperature   ·   colour: final sampling probability', lab, c.h - 10, P.faint, 'left', 11);
    var n = keep.filter(Boolean).length, H = 0;
    fin.forEach(function (v) { if (v > 0) H -= v * Math.log2(v); });
    G.$(root, '[data-n]').textContent = n + ' of ' + toks.length;
    G.$(root, '[data-h]').textContent = G.fmt(H, 2);
    G.$(root, '[data-top]').textContent = G.pct(Math.max.apply(null, fin), 1);
    var purple = fin[11];
    out.innerHTML = (n === 1 ? 'Only one token can be chosen, so decoding is effectively greedy and every run gives the same text. ' :
      'Sampling picks among ' + n + ' tokens. ') +
      (purple > 0 ? 'The nonsense option "purple" still has a <b>' + G.pct(purple, 2) + '</b> chance per draw; over a long response, tail picks like this add up. ' :
       'The nonsense tail ("purple") has been cut. ') +
      (T > 1.2 ? 'High temperature flattens the distribution, raising the chance of odd picks.' : T < 0.4 ? 'Low temperature concentrates mass on the top token.' : '');
  }
  G.on([st, sk, sp, sm], 'input', draw);
  return draw;
});

G.widget('w-in-bon', function (root) {
  var sa = G.$(root, '#in-a'), sd = G.$(root, '#in-d'), sx = G.$(root, '#in-x');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var Ns = [1, 2, 4, 8, 16, 32, 64, 128, 256], cache = { key: '', res: null };
  var wrongW = [0.4, 0.3, 0.2, 0.1];
  function simulate(a, d, x) {
    var key = [a, d, x].join('|'); if (cache.key === key) return cache.res;
    var r = G.rng(11), trials = 2000, bon = [], maj = [];
    Ns.forEach(function (N) {
      var winB = 0, winM = 0;
      for (var t = 0; t < trials; t++) {
        var best = -1e9, bestOk = false, counts = [0, 0, 0, 0, 0];
        for (var i = 0; i < N; i++) {
          var ok = r() < a, s, ans;
          if (ok) { s = d + G.gauss(r); ans = 0; }
          else {
            var u = r(), cum = 0; ans = 4;
            for (var j = 0; j < 4; j++) { cum += wrongW[j]; if (u < cum) { ans = j + 1; break; } }
            s = r() < x ? d + 3.5 + 0.5 * G.gauss(r) : G.gauss(r);
          }
          counts[ans]++;
          if (s > best) { best = s; bestOk = ok; }
        }
        if (bestOk) winB++;
        var top = Math.max.apply(null, counts), ties = [];
        for (var q = 0; q < 5; q++) if (counts[q] === top) ties.push(q);
        if (ties[Math.floor(r() * ties.length)] === 0) winM++;
      }
      bon.push(winB / trials); maj.push(winM / trials);
    });
    cache = { key: key, res: { bon: bon, maj: maj } };
    return cache.res;
  }
  function draw() {
    var a = +sa.value, d = +sd.value, x = +sx.value;
    G.$(root, '#in-a-o').textContent = G.pct(a); G.$(root, '#in-d-o').textContent = G.fmt(d, 1); G.$(root, '#in-x-o').textContent = G.pct(x, 1);
    var res = simulate(a, d, x), P = G.pal(), c = G.canvas(cv, 250), ctx = c.ctx, pad = { l: 46, r: 14, t: 14, b: 36 };
    var s = G.axes(ctx, c.w, c.h, pad, { x: [0, 8], y: [0, 1], xt: [0, 1, 2, 3, 4, 5, 6, 7, 8], xf: function (t) { return String(Math.pow(2, t)); }, yt: [0, 0.25, 0.5, 0.75, 1], yf: function (t) { return G.pct(t); }, xl: 'N samples per question (log scale)', yl: 'accuracy' });
    var O = [], B = [], M = [];
    Ns.forEach(function (N, i) { var lx = s.X(Math.log2(N)); O.push([lx, s.Y(1 - Math.pow(1 - a, N))]); B.push([lx, s.Y(res.bon[i])]); M.push([lx, s.Y(res.maj[i])]); });
    G.line(ctx, O, P.tn, 2, [6, 4]); G.line(ctx, M, P.tp, 2.5); G.line(ctx, B, P.accent, 2.5);
    B.forEach(function (p) { G.dot(ctx, p[0], p[1], 3, P.accent); }); M.forEach(function (p) { G.dot(ctx, p[0], p[1], 3, P.tp); });
    var bi = 0; res.bon.forEach(function (v, i) { if (v > res.bon[bi]) bi = i; });
    var biggestWrong = (1 - a) * wrongW[0];
    out.innerHTML = 'Best-of-N peaks at <b>' + G.pct(res.bon[bi]) + '</b> with N = ' + Ns[bi] + ' and reaches <b>' + G.pct(res.bon[8]) + '</b> at N = 256. Majority vote reaches <b>' + G.pct(res.maj[8]) + '</b>. ' +
      (a > biggestWrong ? 'The right answer (' + G.pct(a) + ') is more common than any single wrong answer (' + G.pct(biggestWrong) + '), so voting converges toward 100%. ' :
       'The most common wrong answer (' + G.pct(biggestWrong) + ') beats the right one (' + G.pct(a) + '), so voting converges to the wrong answer. ') +
      (x > 0 && bi < 8 ? 'Exploits make best-of-N decline after its peak: with enough samples, one that fools the verifier almost always appears.' : '') + ' Simulation with fixed seeds; illustrative.';
  }
  G.on([sa, sd, sx], 'input', draw);
  return draw;
});

G.widget('w-in-kv', function (root) {
  var models = { '8': { L: 32, H: 8, d: 128, params: 8.0e9 }, '70': { L: 80, H: 8, d: 128, params: 70.6e9 }, '70mha': { L: 80, H: 64, d: 128, params: 70.6e9 } };
  var sm = G.$(root, '#in-model'), sc = G.$(root, '#in-ctx'), sb = G.$(root, '#in-b'), sp = G.$(root, '#in-prec');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  function gb(x) { return x >= 1000 ? G.fmt(x / 1000, 2) + ' TB' : G.fmt(x, x < 10 ? 2 : 1) + ' GB'; }
  function draw() {
    var m = models[sm.value], ctx = Math.pow(2, +sc.value), b = Math.pow(2, +sb.value), bp = +sp.value;
    G.$(root, '#in-ctx-o').textContent = (ctx / 1024) + 'K'; G.$(root, '#in-b-o').textContent = b;
    var per = 2 * m.L * m.H * m.d * ctx * bp / 1e9, tot = per * b, w = m.params * bp / 1e9, all = tot + w, gpus = Math.ceil(all / 80);
    G.$(root, '[data-per]').textContent = gb(per); G.$(root, '[data-tot]').textContent = gb(tot);
    G.$(root, '[data-w]').textContent = gb(w); G.$(root, '[data-g]').textContent = String(gpus);
    var P = G.pal(), c = G.canvas(cv, 110), x = c.ctx, pad = 16, W = c.w - 2 * pad, scale = W / Math.max(all, 80) ;
    x.fillStyle = P.deep; x.fillRect(pad, 30, w * scale, 34);
    x.fillStyle = P.fn; x.fillRect(pad + w * scale, 30, tot * scale, 34);
    for (var g = 80; g <= Math.max(all, 80) + 1e-6; g += 80) {
      var gx = pad + g * scale; x.strokeStyle = P.fg; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(gx, 20); x.lineTo(gx, 74); x.stroke(); x.setLineDash([]);
      if (g / 80 <= 12 || g === 80) G.text(x, g + ' GB', gx, 12, P.muted, 'center', 11);
    }
    G.text(x, 'weights', pad, 84, P.deep, 'left', 12); G.text(x, 'KV cache', pad + 70, 84, P.fn, 'left', 12);
    G.text(x, 'dashed lines: each 80 GB accelerator', pad, 100, P.faint, 'left', 11);
    out.innerHTML = 'The cache is <b>' + G.pct(tot / all) + '</b> of memory. ' +
      (sm.value === '70mha' ? 'Without grouped-query attention the cache is 8 times larger than with it.' :
       tot > w ? 'At this context and concurrency the cache, not the weights, decides how many accelerators you need.' : 'Here the weights dominate; longer contexts or more concurrent users would flip that.') +
      ' Activations and runtime overhead are ignored, so real requirements are higher. Precision applies to both weights and cache.';
  }
  G.on([sm, sp], 'change', draw); G.on([sc, sb], 'input', draw);
  return draw;
});

/* Chapter 51: unbiased pass@k (Chen et al. 2021) versus the plug-in 1 - (1 - c/n)^k.
   Binomials are computed in log space so n = 200 never overflows. */
G.widget('w-in-passk', function (root) {
  var sn = G.$(root, '#in-pk-n'), sc = G.$(root, '#in-pk-c'), sk = G.$(root, '#in-pk-k');
  var cv = G.$(root, 'canvas:not([data-c])'), cs = G.$(root, 'canvas[data-c=strip]'), out = G.$(root, '[data-out]');
  var k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  var lf = [0]; for (var i = 1; i <= 400; i++) lf[i] = lf[i - 1] + Math.log(i);   // log factorials
  function lnC(a, b) { return lf[a] - lf[b] - lf[a - b]; }
  function passAtK(n, c, kk) {           // same branches as the chapter's pass_at_k
    if (n - c < kk) return 1.0;
    return 1.0 - Math.exp(lnC(n - c, kk) - lnC(n, kk));
  }
  function plugIn(n, c, kk) { return 1 - Math.pow(1 - c / n, kk); }
  function binomPmf(n, c, p) {
    if (p <= 0) return c === 0 ? 1 : 0;
    if (p >= 1) return c === n ? 1 : 0;
    return Math.exp(lnC(n, c) + c * Math.log(p) + (n - c) * Math.log(1 - p));
  }
  function shuffled(n, r, m) {           // first m entries of a seeded Fisher-Yates shuffle of 0..n-1
    var a = []; for (var i = 0; i < n; i++) a.push(i);
    for (i = 0; i < m; i++) { var j = i + Math.floor(r() * (n - i)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a.slice(0, m);
  }
  var draws = 0;
  G.on(G.$(root, '[data-draw]'), 'click', function () { draws++; draw(); });
  function draw() {
    var n = +sn.value;
    sc.max = n; sk.max = n;
    if (+sc.value > n) sc.value = n;
    if (+sk.value > n) sk.value = n;
    var c = +sc.value, kk = +sk.value;
    G.$(root, '#in-pk-n-o').textContent = n; G.$(root, '#in-pk-c-o').textContent = c; G.$(root, '#in-pk-k-o').textContent = kk;
    var u = passAtK(n, c, kk), pl = plugIn(n, c, kk);

    /* curve against k */
    var P = G.pal(), cc = G.canvas(cv, 250), ctx = cc.ctx, pad = { l: 46, r: 14, t: 16, b: 36 };
    var xt = n <= 10 ? Array.from({ length: n }, function (_, i) { return i + 1; }) : [1].concat([0.25, 0.5, 0.75, 1].map(function (f) { return Math.max(2, Math.round(f * n)); }));
    var s = G.axes(ctx, cc.w, cc.h, pad, { x: [n > 1 ? 1 : 0.5, n > 1 ? n : 1.5], y: [0, 1], xt: xt, yt: [0, 0.25, 0.5, 0.75, 1], yf: function (t) { return G.pct(t); }, xl: 'k, attempts allowed', yl: 'pass@k' });
    if (n - c >= 1 && n - c < n) {      // shade where any k-subset must contain a correct sample
      ctx.fillStyle = P.accentSoft; ctx.globalAlpha = 0.6;
      var xs = s.X(Math.min(n, n - c + 0.5));
      ctx.fillRect(xs, pad.t, cc.w - pad.r - xs, cc.h - pad.t - pad.b); ctx.globalAlpha = 1;
      if (cc.w - pad.r - xs > 90) G.text(ctx, 'k > n − c: certain', cc.w - pad.r - 6, pad.t + 26, P.accent, 'right', 11);
    }
    var U = [], PL = [];
    for (var j = 1; j <= n; j++) { U.push([s.X(j), s.Y(passAtK(n, c, j))]); PL.push([s.X(j), s.Y(plugIn(n, c, j))]); }
    G.line(ctx, PL, P.fn, 2.2, [6, 4]);
    G.line(ctx, U, P.accent, 2.6);
    if (n <= 40) for (j = 1; j <= n; j++) { G.dot(ctx, U[j - 1][0], U[j - 1][1], 2.6, P.accent); G.dot(ctx, PL[j - 1][0], PL[j - 1][1], 2.2, P.fn); }
    G.line(ctx, [[s.X(kk), pad.t], [s.X(kk), cc.h - pad.b]], P.fg, 1, [3, 3]);
    G.dot(ctx, s.X(kk), s.Y(u), 5.5, P.accent, P.surface); G.dot(ctx, s.X(kk), s.Y(pl), 5, P.fn, P.surface);

    /* the n samples, the c correct ones, and one random k-subset */
    var corr = {}, sub = {};
    shuffled(n, G.rng(n * 1009 + c * 7 + 1), c).forEach(function (x) { corr[x] = 1; });
    shuffled(n, G.rng(4242 + draws * 31 + n), kk).forEach(function (x) { sub[x] = 1; });
    var W = cs.parentElement.clientWidth || 600, cell = 28;
    while (cell > 7 && Math.ceil(n / Math.floor((W - 4) / cell)) > 4) cell--;
    var cols = Math.floor((W - 4) / cell), rows = Math.ceil(n / cols);
    var c2 = G.canvas(cs, rows * cell + 46), x2 = c2.ctx, hit = false;
    for (j = 0; j < n; j++) {
      var cx = 2 + (j % cols) * cell, cy = 40 + Math.floor(j / cols) * cell, sz = cell - 3;
      x2.fillStyle = corr[j] ? P.tp : P.sunk; x2.fillRect(cx, cy, sz, sz);
      if (!corr[j] && !sub[j]) { x2.strokeStyle = P.line; x2.lineWidth = 1; x2.strokeRect(cx + 0.5, cy + 0.5, sz - 1, sz - 1); }
      if (sub[j]) { x2.strokeStyle = P.fg; x2.lineWidth = cell > 11 ? 2 : 1.4; x2.strokeRect(cx + 1, cy + 1, sz - 2, sz - 2); if (corr[j]) hit = true; }
    }
    G.text(x2, 'Your ' + n + ' samples (green = correct).', 2, 9, P.muted, 'left', 12);
    G.text(x2, 'Outlined: a random ' + kk + ' of them, ' + (hit ? 'with a correct one.' : 'with no correct one.'), 2, 26, hit ? P.tp : P.fp, 'left', 12);

    /* Monte Carlo check of the estimator's meaning: share of random k-subsets containing a correct sample */
    var r = G.rng(99 + n * 13 + c * 17 + kk), good = 0, idx = [];
    for (j = 0; j < n; j++) idx.push(j);
    for (var it = 0; it < 2000; it++) {
      var any = false;
      for (var q = 0; q < kk; q++) { var z = q + Math.floor(r() * (n - q)), t = idx[q]; idx[q] = idx[z]; idx[z] = t; if (idx[q] < c) any = true; }
      if (any) good++;
    }
    // (samples 0..c-1 count as correct here; positions are exchangeable, so this matches the picture's shares)

    /* expected value of each estimator if the true solve rate were exactly c / n */
    var p = c / n, eu = 0, ep = 0;
    for (j = 0; j <= n; j++) { var w = binomPmf(n, j, p); eu += w * passAtK(n, j, kk); ep += w * plugIn(n, j, kk); }
    var truth = 1 - Math.pow(1 - p, kk);

    k('u').textContent = G.pct(u, 1); k('p').textContent = G.pct(pl, 1);
    var d = pl - u, dv = G.fmt(Math.abs(d) * 100, 1); k('d').textContent = (dv === '0.0' ? '' : d > 0 ? '+' : '−') + dv + ' pts';
    k('sim').textContent = G.pct(good / 2000, 1);
    var msg = 'With ' + c + ' correct out of ' + n + ', the unbiased estimate asks: if you picked ' + kk + ' of these ' + n + ' samples at random, how often would at least one be correct? Answer <b>' + G.pct(u, 1) +
      '</b> (the random-subset check gives ' + G.pct(good / 2000, 1) + '). The plug-in formula gives <b>' + G.pct(pl, 1) + '</b>. ';
    if (c === 0 || c === n) msg += 'With ' + (c === 0 ? 'no' : 'every') + ' sample correct, both formulas agree at ' + G.pct(u) + ' for every k. ';
    else if (kk === 1) msg += 'At k = 1 they always agree: both equal c/n = ' + G.pct(p, 1) + '. ';
    else if (n - c < kk) msg += 'Here k is larger than the ' + (n - c) + ' wrong samples, so every subset of ' + kk + ' must contain a correct one and the unbiased estimate is exactly 100%. The plug-in never reaches 100%. When this happens at a k you report, n is too small. ';
    else msg += 'The plug-in treats the k attempts as independent draws with replacement from a rate of ' + G.pct(p, 1) + '; the samples you actually have are drawn without replacement, and that gap grows with k/n. ';
    if (c > 0 && c < n && kk > 1) msg += 'The real problem is bias: if this problem\'s true solve rate were exactly ' + G.pct(p, 1) + ', the true pass@' + kk + ' is ' + G.pct(truth, 1) + '. Rerunning n = ' + n + ' samples many times, the unbiased formula averages ' + G.pct(eu, 1) +
      ' and the plug-in averages ' + G.pct(ep, 1) + ', ' + G.fmt((truth - ep) * 100, 1) + ' points low. Averaged over a benchmark, that error does not cancel.';
    out.innerHTML = msg;
  }
  G.on([sn, sc, sk], 'input', draw);
  return draw;
});
