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
