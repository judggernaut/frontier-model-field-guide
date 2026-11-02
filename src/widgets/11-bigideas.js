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

/* Archer's target: SD of single arrows vs SE of volley averages */
G.widget('w-se-archer', function (root) {
  var sN = G.$(root, '#sea-n'), sS = G.$(root, '#sea-s'), oN = G.$(root, '#sea-n-o'), oS = G.$(root, '#sea-s-o');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]'), k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  var NS = [1, 2, 5, 10, 20, 40, 80, 160], MAXV = 300;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var volleys = [], rnd = G.rng(31), timer = null, queued = 0;
  function shoot() {
    var n = NS[+sN.value], s = +sS.value, a = [], mx = 0, my = 0;
    for (var i = 0; i < n; i++) { var x = s * G.gauss(rnd), y = s * G.gauss(rnd); a.push([x, y]); mx += x; my += y; }
    volleys.push({ a: a, m: [mx / n, my / n] });
    if (volleys.length > MAXV) volleys.shift();
  }
  function stop() { if (timer) clearInterval(timer); timer = null; queued = 0; }
  function refill(count) { stop(); volleys = []; rnd = G.rng(31); for (var i = 0; i < count; i++) shoot(); }
  function pooledSd(pts) { // per-direction sample SD, pooling x and y
    var m = pts.length; if (m < 2) return NaN;
    var mx = 0, my = 0; pts.forEach(function (p) { mx += p[0]; my += p[1]; }); mx /= m; my /= m;
    var ss = 0; pts.forEach(function (p) { ss += (p[0] - mx) * (p[0] - mx) + (p[1] - my) * (p[1] - my); });
    return Math.sqrt(ss / (2 * (m - 1)));
  }
  function draw() {
    var P = G.pal(), n = NS[+sN.value], s = +sS.value, se = s / Math.sqrt(n), V = volleys.length;
    oN.textContent = n; oS.textContent = G.fmt(s, 1);
    var w = cv.parentElement.clientWidth || 640, H = Math.round(Math.min(400, Math.max(300, w * 0.58)));
    var c = G.canvas(cv, H), ctx = c.ctx, cx = c.w / 2, cy = H / 2, u = (H / 2 - 10) / 3.25;
    function X(v) { return cx + v * u; } function Y(v) { return cy - v * u; }
    function halo(str, x, y, col, align) { // text with a background-coloured outline so it reads over dots
      ctx.font = '12px ' + G.css('--font-body', 'sans-serif'); ctx.textAlign = align; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = P.surface; ctx.strokeText(str, x, y); ctx.fillStyle = col; ctx.fillText(str, x, y);
    }
    for (var r = 6; r >= 1; r--) { // rings every 0.5 units, target radius 3
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.5 * u, 0, Math.PI * 2); ctx.fillStyle = r % 2 ? P.sunk : P.surface; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = P.line; ctx.stroke();
    }
    G.line(ctx, [[cx - 6, cy], [cx + 6, cy]], P.faint, 1); G.line(ctx, [[cx, cy - 6], [cx, cy + 6]], P.faint, 1);
    G.text(ctx, 'rings are 0.5 units apart', 8, 14, P.faint, 'left', 11);
    var last = V ? volleys[V - 1] : null;
    if (last) { ctx.globalAlpha = n > 40 ? 0.6 : 0.85; last.a.forEach(function (p) { G.dot(ctx, X(p[0]), Y(p[1]), n > 40 ? 2.4 : 3.2, P.accent); }); ctx.globalAlpha = 1; }
    ctx.globalAlpha = 0.8; volleys.forEach(function (v, i) { if (i < V - 1) G.dot(ctx, X(v.m[0]), Y(v.m[1]), 2.6, P.lead); }); ctx.globalAlpha = 1;
    // the two reference circles, centred on the bullseye (the archer aims true)
    ctx.lineWidth = 1.8; ctx.strokeStyle = P.accent; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(cx, cy, s * u, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 2; ctx.strokeStyle = P.lead; ctx.beginPath(); ctx.arc(cx, cy, Math.max(se * u, 1.5), 0, Math.PI * 2); ctx.stroke();
    // labels sit outside the dashed circle on leader lines, left for SE and right for SD
    var ySE = cy + Math.min(H / 2 - 16, s * u + 18), ySD = cy - Math.min(H / 2 - 16, s * u + 18);
    var eSE = Math.max(se * u, 1.5) * Math.SQRT1_2, eSD = s * u * Math.SQRT1_2;
    G.line(ctx, [[cx - eSE, cy + eSE], [cx - s * u * 0.9, ySE], [cx - s * u - 6, ySE]], P.lead, 1.2);
    halo('±1 SE = ' + G.fmt(se, 2), cx - s * u - 10, ySE, P.lead, 'right');
    G.line(ctx, [[cx + eSD, cy - eSD], [cx + s * u * 0.9, ySD], [cx + s * u + 6, ySD]], P.accent, 1.2);
    halo('±1 SD = ' + G.fmt(s, 1), cx + s * u + 10, ySD, P.accent, 'left');
    if (last) G.dot(ctx, X(last.m[0]), Y(last.m[1]), 5.5, P.lead, P.surface);
    var sdv = last ? pooledSd(last.a) : NaN, obs = pooledSd(volleys.map(function (v) { return v.m; }));
    k('sd').textContent = G.fmt(s, 2); k('sdv').textContent = G.fmt(sdv, 2); k('se').textContent = G.fmt(se, 3);
    k('obs').textContent = G.fmt(obs, 3); k('nv').textContent = V;
    if (!V) { out.innerHTML = 'The target is empty. The dashed circle shows where single arrows typically land (±σ); the small solid circle shows how far a volley average typically lands from the bullseye (±σ/√n). Press <b>Shoot a volley</b>.'; return; }
    out.innerHTML = 'Each arrow misses the bullseye by about <b>σ = ' + G.fmt(s, 1) + '</b> units in each direction (dashed circle, first card)' +
      (n > 1 ? '; the latest volley’s own scatter is ' + G.fmt(sdv, 2) + ' (second card)' : '; with one arrow per volley the average is just that arrow, so the two circles coincide') + '. The average of n = ' + n + ' arrows wobbles only about <b>σ/√n = ' + G.fmt(se, 2) +
      '</b> units (solid circle, third card). ' + (V >= 2 ? 'Across ' + V + ' volleys the averages actually spread ' + G.fmt(obs, 2) + ' (fourth card), ' +
      (Math.abs(obs - se) / se < 0.25 ? 'close to the formula.' : 'still settling toward the formula; shoot more volleys.') : 'Shoot a second volley to measure the wobble directly.') +
      ' Quadruple the arrows to ' + (4 * n) + ' and the SE would halve to ' + G.fmt(se / 2, 2) + ' while σ stays ' + G.fmt(s, 1) + '. (In two dimensions only about 4 arrows in 10 fall inside a 1 SD circle; compare the two circles, not the counts.)';
  }
  G.on([sN, sS], 'input', function () { refill(volleys.length); draw(); });
  G.on(G.$(root, '[data-one]'), 'click', function () { stop(); shoot(); draw(); });
  G.on(G.$(root, '[data-many]'), 'click', function () {
    if (reduce) { stop(); for (var i = 0; i < 20; i++) shoot(); draw(); return; }
    queued += 20;
    if (!timer) timer = setInterval(function () { shoot(); draw(); if (--queued <= 0) stop(); }, 70);
  });
  G.on(G.$(root, '[data-reset]'), 'click', function () { refill(0); draw(); });
  refill(12);
  return draw;
});

/* Accuracy vs precision: bias and variance on a dartboard, MSE = bias^2 + variance */
G.widget('w-bv-dartboard', function (root) {
  var sB = G.$(root, '#bvd-b'), sS = G.$(root, '#bvd-s'), oB = G.$(root, '#bvd-b-o'), oS = G.$(root, '#bvd-s-o');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]'), k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  // 30 fixed throws, centred and scaled so their mean is exactly 0 and mean squared distance exactly 1.
  // Then throw = bias·dir + spread·z has mean bias·dir and variance spread² exactly, so the cards add up.
  var r = G.rng(17), z = [], N = 30, i, mx = 0, my = 0, ss = 0;
  for (i = 0; i < N; i++) { z.push([G.gauss(r), G.gauss(r)]); mx += z[i][0]; my += z[i][1]; }
  mx /= N; my /= N; z.forEach(function (p) { p[0] -= mx; p[1] -= my; ss += p[0] * p[0] + p[1] * p[1]; });
  var sc = Math.sqrt(N / ss); z.forEach(function (p) { p[0] *= sc; p[1] *= sc; });
  var ang = 40 * Math.PI / 180, dir = [Math.cos(ang), Math.sin(ang)], ACC = 0.5, PREC = 0.6, BARMAX = 10;
  function draw() {
    var P = G.pal(), b = +sB.value, s = +sS.value, b2 = b * b, v = s * s, mse = b2 + v;
    oB.textContent = G.fmt(b, 2); oS.textContent = G.fmt(s, 2);
    var w = cv.parentElement.clientWidth || 640, TH = Math.round(Math.min(340, Math.max(280, w * 0.55)));
    var c = G.canvas(cv, TH + 84), ctx = c.ctx, cx = c.w / 2, cy = TH / 2, u = (TH / 2 - 8) / 3.15;
    function X(t) { return cx + t * u; } function Y(t) { return cy - t * u; }
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, c.w, TH); ctx.clip();
    for (var q = 6; q >= 1; q--) { // rings every 0.5 units, target radius 3
      ctx.beginPath(); ctx.arc(cx, cy, q * 0.5 * u, 0, Math.PI * 2); ctx.fillStyle = q % 2 ? P.sunk : P.surface; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = P.line; ctx.stroke();
    }
    G.dot(ctx, cx, cy, 3, P.faint);
    var mu = [b * dir[0], b * dir[1]];
    ctx.lineWidth = 1.5; ctx.strokeStyle = P.accent; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(X(mu[0]), Y(mu[1]), s * u, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.8; z.forEach(function (p) { G.dot(ctx, X(mu[0] + s * p[0]), Y(mu[1] + s * p[1]), 3.4, P.accent); }); ctx.globalAlpha = 1;
    if (b > 0.08) {
      G.line(ctx, [[cx, cy], [X(mu[0]), Y(mu[1])]], P.lead, 2.2);
      var lx = X(mu[0] / 2) + 14 * dir[1], ly = Y(mu[1] / 2) + 14 * dir[0];
      ctx.font = '12px ' + G.css('--font-body', 'sans-serif'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = 4; ctx.strokeStyle = P.surface; ctx.strokeText('bias ' + G.fmt(b, 2), lx, ly); ctx.fillStyle = P.lead; ctx.fillText('bias ' + G.fmt(b, 2), lx, ly);
    }
    G.dot(ctx, X(mu[0]), Y(mu[1]), 6, P.lead, P.surface);
    ctx.restore();
    var acc = b <= ACC, prec = s <= PREC;
    function pill(str, y, ok) {
      ctx.font = '600 12px ' + G.css('--font-body', 'sans-serif'); var tw = ctx.measureText(str).width, col = ok ? P.good : P.warn;
      ctx.fillStyle = col; ctx.globalAlpha = 0.14; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(2, y - 10, tw + 16, 20, 10) : ctx.rect(2, y - 10, tw + 16, 20); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(str, 10, y);
    }
    pill(acc ? 'Accurate: yes' : 'Accurate: no', 13, acc); pill(prec ? 'Precise: yes' : 'Precise: no', 39, prec);
    G.text(ctx, 'rings are 0.5 units apart', c.w - 4, 13, P.faint, 'right', 11);
    // MSE bar
    var L = 12, Rr = c.w - 12, BW = Rr - L, y0 = TH + 28;
    G.text(ctx, 'mean squared error = bias² + variance', L, TH + 14, P.muted, 'left', 12);
    ctx.fillStyle = P.sunk; ctx.fillRect(L, y0, BW, 18);
    var wb = BW * b2 / BARMAX, wv = BW * v / BARMAX;
    ctx.fillStyle = P.lead; ctx.fillRect(L, y0, wb, 18); ctx.fillStyle = P.eli5; ctx.fillRect(L + wb, y0, wv, 18);
    G.text(ctx, String(BARMAX), Rr, y0 + 30, P.faint, 'right', 11);
    var parts = [['bias² ' + G.fmt(b2, 2), P.lead], [' + ', P.muted], ['variance ' + G.fmt(v, 2), P.eli5], [' = MSE ' + G.fmt(mse, 2), P.fg]], xx = L;
    ctx.font = '12.5px ' + G.css('--font-body', 'sans-serif');
    parts.forEach(function (pt) { G.text(ctx, pt[0], xx, y0 + 30, pt[1], 'left', 12.5); xx += ctx.measureText(pt[0]).width; });
    k('b').textContent = G.fmt(b, 2); k('b2').textContent = G.fmt(b2, 2); k('v').textContent = G.fmt(v, 2); k('mse').textContent = G.fmt(mse, 2);
    var name = acc && prec ? 'Accurate and precise.' : prec ? 'Precise, not accurate.' : acc ? 'Accurate, not precise.' : 'Neither accurate nor precise.';
    var share = mse > 0 ? b2 / mse : 0;
    out.innerHTML = '<b>' + name + '</b> The ' + N + ' throws sit about ' + G.fmt(s, 2) + ' units from their own centre (spread), and that centre sits ' + G.fmt(b, 2) +
      ' units from the bullseye (bias). Average squared miss = ' + G.fmt(b, 2) + '² + ' + G.fmt(s, 2) + '² = ' + G.fmt(b2, 2) + ' + ' + G.fmt(v, 2) + ' = <b>' + G.fmt(mse, 2) +
      '</b>; bias is ' + G.pct(share) + ' of it. ' +
      (share > 0.5 ? 'Throwing more darts would pin down the mean point more tightly but leave it just as far from the bullseye: only fixing the aim removes bias. In eval terms, more tasks shrink the standard error, but a leaked or mis-graded benchmark stays wrong.'
        : 'Most of the error is scatter. Averaging many throws helps here: the mean of n throws wobbles only spread/√n, which is what the standard error measures.') +
      ' (The labels use illustrative cut-offs: accurate means bias ≤ ' + G.fmt(ACC, 1) + ' units, precise means spread ≤ ' + G.fmt(PREC, 1) + ' units.)';
  }
  G.on([sB, sS], 'input', draw);
  G.$$(root, '[data-q]').forEach(function (btn) {
    G.on(btn, 'click', function () { var q = btn.getAttribute('data-q').split(','); sB.value = q[0]; sS.value = q[1]; sB.dispatchEvent(new Event('input')); });
  });
  return draw;
});

/* Where a p value comes from: simulate the no-difference world, shade the tail */
G.widget('w-pv-sim', function (root) {
  var sD = G.$(root, '#pvs-d'), sN = G.$(root, '#pvs-n'), sE = G.$(root, '#pvs-e'), bE = G.$(root, '[data-eff]');
  var oD = G.$(root, '#pvs-d-o'), oN = G.$(root, '#pvs-n-o'), oE = G.$(root, '#pvs-e-o');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]'), altLeg = G.$(root, '[data-altleg]'), k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  var NS = [50, 100, 200, 400, 800, 1600], P0 = 0.6, R = 10000, cache = {}, eff = false;
  function cdf(n, p) { // binomial CDF table, built in log space so large n does not underflow
    var key = n + ':' + p; if (cache[key]) return cache[key];
    var lp = [n * Math.log(1 - p)], i, mx = lp[0];
    for (i = 0; i < n; i++) { lp.push(lp[i] + Math.log((n - i) / (i + 1)) + Math.log(p) - Math.log(1 - p)); if (lp[i + 1] > mx) mx = lp[i + 1]; }
    var e = lp.map(function (v) { return Math.exp(v - mx); }), t = G.sum(e), acc = 0;
    return (cache[key] = e.map(function (v) { acc += v / t; return acc; }));
  }
  function draw1(tab, u) { var lo = 0, hi = tab.length - 1; while (lo < hi) { var m = (lo + hi) >> 1; if (tab[m] >= u) hi = m; else lo = m + 1; } return lo; }
  function sim(n, pB, seed) { // integer gaps kB - kA over R reruns
    var key = 'sim' + n + ':' + pB; if (cache[key]) return cache[key];
    var ta = cdf(n, P0), tb = cdf(n, pB), r = G.rng(seed), d = new Int32Array(R);
    for (var i = 0; i < R; i++) d[i] = draw1(tb, r()) - draw1(ta, r());
    return (cache[key] = d);
  }
  function draw() {
    var P = G.pal(), dObs = +sD.value, n = NS[+sN.value], del = +sE.value;
    oD.textContent = G.fmt(dObs, 1); oN.textContent = n; oE.textContent = '+' + del;
    bE.setAttribute('aria-pressed', eff ? 'true' : 'false'); altLeg.style.display = eff ? '' : 'none';
    var nul = sim(n, P0, 100 + n), obsK = dObs / 100 * n, cnt = 0, i;
    var absS = Array.prototype.slice.call(nul).map(Math.abs).sort(function (a, b) { return a - b; });
    function tail(c) { var lo = 0, hi = R; while (lo < hi) { var m = (lo + hi) >> 1; if (absS[m] >= c) hi = m; else lo = m + 1; } return R - lo; }
    cnt = tail(obsK - 1e-9); var p = cnt / R;
    var crit = 0; while (crit <= n && tail(crit) >= 0.05 * R) crit++;   // smallest |gap| with p < 0.05
    var alt = eff ? sim(n, P0 + del / 100, 7000 + n * 31 + del) : null, pow = NaN;
    if (alt) { var hits = 0; for (i = 0; i < R; i++) if (Math.abs(alt[i]) >= crit) hits++; pow = hits / R; }
    // histogram geometry, in points
    var se = 100 * Math.sqrt(2 * P0 * (1 - P0) / n);
    var xmax = Math.max(4.2 * se, dObs * 1.15, eff ? del + 3.8 * se : 0);
    var raw = 2 * xmax / 100 * n / 70, kb = Math.max(1, 2 * Math.floor(Math.max(1, raw) / 2) + 1), half = (kb - 1) / 2;
    var nb = Math.ceil(xmax / 100 * n / kb) + 1, bins = {};
    function add(arr, key, ext) {
      for (var j = 0; j < arr.length; j++) {
        var bi = Math.round(arr[j] / kb); if (Math.abs(bi) > nb) continue;
        var o = bins[bi] || (bins[bi] = { a: 0, t: 0, b: 0 });
        if (ext) { o.a++; if (Math.abs(arr[j]) >= obsK - 1e-9) o.t++; } else o.b++;
      }
    }
    add(nul, 0, true); if (alt) add(alt, 0, false);
    var ymax = 1; Object.keys(bins).forEach(function (kk) { ymax = Math.max(ymax, bins[kk].a, bins[kk].b); }); ymax *= 1.12;
    var c = G.canvas(cv, 250), ctx = c.ctx, pad = { l: 14, r: 14, t: 26, b: 34 };
    var stepT = [1, 2, 5, 10, 20, 25, 50].filter(function (st) { return xmax / st <= 4; })[0] || 50, xt = [];
    for (var tv = -Math.floor(xmax / stepT) * stepT; tv <= xmax + 1e-9; tv += stepT) xt.push(tv);
    var ax = G.axes(ctx, c.w, c.h, pad, { x: [-xmax, xmax], y: [0, ymax], xt: xt, xf: function (v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v); }, xl: 'gap in pass rate, B − A (points)', yl: 'reruns' });
    var bwPts = kb / n * 100;
    Object.keys(bins).forEach(function (kk) {
      var o = bins[kk], x0 = ax.X((+kk * kb - half - 0.5) / n * 100), x1 = ax.X((+kk * kb + half + 0.5) / n * 100), wpx = Math.max(1, x1 - x0 - (x1 - x0 > 4 ? 1 : 0));
      if (o.a) {
        ctx.fillStyle = P.accent; ctx.globalAlpha = 0.45; ctx.fillRect(x0, ax.Y(o.a - o.t), wpx, ax.Y(0) - ax.Y(o.a - o.t));
        ctx.globalAlpha = 0.9; ctx.fillStyle = P.warn; ctx.fillRect(x0, ax.Y(o.a), wpx, ax.Y(o.a - o.t) - ax.Y(o.a)); ctx.globalAlpha = 1;
      }
    });
    if (alt) { // outline of the "B truly better" histogram
      var keys = Object.keys(bins).map(Number).sort(function (a, b) { return a - b; }), pts = [];
      keys.forEach(function (kk) { var o = bins[kk]; var x0 = ax.X((kk * kb - half - 0.5) / n * 100), x1 = ax.X((kk * kb + half + 0.5) / n * 100); pts.push([x0, ax.Y(o.b)], [x1, ax.Y(o.b)]); });
      G.line(ctx, pts, P.eli5, 2);
      [crit, -crit].forEach(function (cc) { // the p < 0.05 cut-offs, so "beyond the cut-off" can be seen
        var x = ax.X((cc - Math.sign(cc) * 0.5) / n * 100);
        G.line(ctx, [[x, c.h - pad.b], [x, c.h - pad.b - (c.h - pad.t - pad.b) * 0.45]], P.muted, 1.2, [2, 3]);
      });
      G.text(ctx, 'dotted: p < 0.05 cut-offs', c.w - pad.r, pad.t + 6, P.muted, 'right', 11);
    }
    [dObs, -dObs].forEach(function (d, j) {
      if (dObs === 0 && j) return;
      var x = ax.X(d); G.line(ctx, [[x, pad.t - 4], [x, c.h - pad.b]], P.fg, 1.5, [4, 3]);
      var lab = j ? 'mirror ' + '−' + G.fmt(dObs, 1) : 'your gap ' + (dObs > 0 ? '+' : '') + G.fmt(dObs, 1);
      ctx.font = '12px ' + G.css('--font-body', 'sans-serif'); var tw = ctx.measureText(lab).width;
      var tx = j ? Math.max(pad.l, Math.min(x - tw / 2, x - 4 - tw)) : Math.min(c.w - pad.r - tw, x + 4);
      if (dObs === 0) tx = Math.max(pad.l, x - tw / 2);
      G.text(ctx, lab, tx, 12, P.fg, 'left', 12);
    });
    var pTxt = cnt === 0 ? '&lt; 1 in ' + R.toLocaleString('en-US') : G.fmt(p, p < 0.01 ? 4 : 3);
    k('p').innerHTML = pTxt; k('cnt').textContent = cnt + ' / ' + R.toLocaleString('en-US');
    k('crit').textContent = '±' + G.fmt(crit / n * 100, 1); k('pow').textContent = eff ? G.pct(pow) : 'off';
    var s = 'If A and B were truly identical (both pass 60%) and each ran n = ' + n + ' tasks, a gap of ' + G.fmt(dObs, 1) + ' points or more in <i>either</i> direction turned up in <b>' +
      cnt + ' of ' + R.toLocaleString('en-US') + '</b> simulated reruns (orange). That share is the p value: <b>p ' + (cnt ? '≈ ' + pTxt : pTxt) + '</b>. ' +
      'It is <b>not</b> the probability that the models are identical, not the chance your result is a fluke, and it says nothing about whether ' + G.fmt(dObs, 1) +
      ' points matters. At this n, any gap of ±' + G.fmt(crit / n * 100, 1) + ' points or more would give p &lt; 0.05. ';
    s += eff ? 'With a real edge of ' + del + ' points, <b>' + G.pct(pow) + '</b> of experiments at n = ' + n + ' reach p &lt; 0.05 (the part of the blue outline beyond the dotted ±' + G.fmt(crit / n * 100, 1) + ' cut-offs): that is the power. ' +
      (pow < 0.8 ? 'The other ' + G.pct(1 - pow) + ' would report "no significant difference" even though B really is better.' : 'Above the usual 80% target, so a miss would be unusual.')
      : 'Press <b>Add a true effect</b> to see how often a real edge clears that bar.';
    out.innerHTML = s;
  }
  G.on([sD, sN, sE], 'input', draw);
  G.on(bE, 'click', function () { eff = !eff; draw(); });
  return draw;
});
