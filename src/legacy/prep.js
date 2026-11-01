
/* ============ W9: paired comparison / McNemar ============ */
function widgetMcnemar(root) {
  var sn = root.querySelector('[data-n]'), sag = root.querySelector('[data-ag]'),
      sef = root.querySelector('[data-ef]'), cv = root.querySelector('canvas'),
      out = root.querySelector('[data-out]'), grid = root.querySelector('[data-grid]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]'), l3 = root.querySelector('[data-l3]');

  function logC(n, k) {                       // log of n-choose-k, avoids overflow at large n
    var r = 0;
    for (var i = 0; i < k; i++) r += Math.log(n - i) - Math.log(i + 1);
    return r;
  }
  function exactP(b, c) {                     // two sided exact binomial on discordant pairs
    var n = b + c;
    if (n === 0) return 1;
    var k = Math.min(b, c), tail = 0;
    for (var i = 0; i <= k; i++) tail += Math.exp(logC(n, i) - n * Math.LN2);
    return Math.min(1, 2 * tail);
  }

  function draw() {
    var P = pal(), n = parseInt(sn.value, 10), ag = parseFloat(sag.value), ef = parseFloat(sef.value);
    l1.textContent = 'tasks ' + n;
    l2.textContent = 'model agreement ' + fmt(ag, 2);
    l3.textContent = 'true effect ' + fmt(ef, 3);

    var rnd = mulberry32(23), base = 0.5;
    var a = [], b = [];
    for (var i = 0; i < n; i++) {
      var shared = rnd() < ag, x, y;
      if (shared) { var u = rnd(); x = u < base + ef ? 1 : 0; y = u < base ? 1 : 0; }
      else { x = rnd() < base + ef ? 1 : 0; y = rnd() < base ? 1 : 0; }
      a.push(x); b.push(y);
    }
    var bb = 0, cc = 0, both = 0, neither = 0;
    for (i = 0; i < n; i++) {
      if (a[i] && !b[i]) bb++; else if (!a[i] && b[i]) cc++;
      else if (a[i] && b[i]) both++; else neither++;
    }
    var p = exactP(bb, cc);

    // paired bootstrap on the per task difference
    var reps = [];
    for (var t = 0; t < 3000; t++) {
      var sa = 0, sb = 0;
      for (i = 0; i < n; i++) { var j = Math.floor(rnd() * n); sa += a[j]; sb += b[j]; }
      reps.push((sa - sb) / n);
    }
    reps.sort(function (x, y) { return x - y; });
    var lo = quantile(reps, 0.025), hi = quantile(reps, 0.975);
    var obs = (a.reduce(function (x, y) { return x + y; }, 0) - b.reduce(function (x, y) { return x + y; }, 0)) / n;

    var c = setupCanvas(cv, 170), ctx = c.ctx, pad = { l: 36, r: 14, t: 14, b: 30 };
    axes(ctx, c.w, c.h, pad, 'bootstrap difference in pass rate', 'count', P);
    var lowest = Math.min(reps[0], -0.01), highest = Math.max(reps[reps.length - 1], 0.01);
    var bins = 44, counts = new Array(bins).fill(0);
    reps.forEach(function (v) {
      counts[Math.min(bins - 1, Math.max(0, Math.floor((v - lowest) / (highest - lowest) * bins)))]++;
    });
    var cmax = Math.max.apply(null, counts) || 1, pw = (c.w - pad.l - pad.r) / bins;
    for (var k2 = 0; k2 < bins; k2++) {
      var vlo = lowest + (k2 / bins) * (highest - lowest);
      ctx.fillStyle = (vlo < 0) ? P.line : P.a3;
      var bh = (counts[k2] / cmax) * (c.h - pad.t - pad.b);
      ctx.fillRect(pad.l + k2 * pw, c.h - pad.b - bh, Math.max(1, pw - 1), bh);
    }
    var zx = pad.l + (0 - lowest) / (highest - lowest) * (c.w - pad.l - pad.r);
    ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(zx, pad.t); ctx.lineTo(zx, c.h - pad.b); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = P.accent; ctx.font = '600 11px ui-sans-serif,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('no difference', zx + 4, pad.t + 12);

    var cells = [['A wins (b)', bb, P.a3], ['B wins (c)', cc, P.warn],
                 ['both pass', both, P.line], ['both fail', neither, P.line]];
    var mx = Math.max(bb, cc, both, neither) || 1;
    grid.innerHTML = cells.map(function (x) {
      return '<div class="cmcell" style="background:' + x[2] + ';opacity:' +
        (0.3 + 0.7 * (0.15 + 0.6 * x[1] / mx)) + '"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>';
    }).join('');

    var sig = p < 0.05;
    out.innerHTML =
      '<b>Discordant pairs:</b> ' + (bb + cc) + ' of ' + n + ' tasks. Everything else carries no information.' +
      '<br><b>Exact McNemar p</b> = <b style="color:' + (sig ? P.a3 : P.warn) + '">' + fmt(p, 4) + '</b>' +
      ' &nbsp; <b>bootstrap 95% CI</b> [' + fmt(lo, 4) + ', ' + fmt(hi, 4) + ']' +
      '<br>Observed difference ' + fmt(obs, 4) + '. ' +
      (sig ? '<span style="color:' + P.a3 + '">Significant at 0.05.</span>'
           : '<span style="color:' + P.warn + '"><b>Not significant.</b> This difference is consistent with noise, however convincing the raw win count looks.</span>');
  }
  [sn, sag, sef].forEach(function (e) { e.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ============ W10: multiple comparisons ============ */
function widgetMultcomp(root) {
  var sm = root.querySelector('[data-m]'), st = root.querySelector('[data-t]'),
      cv = root.querySelector('canvas'), out = root.querySelector('[data-out]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]');
  function draw() {
    var P = pal(), m = parseInt(sm.value, 10), nTrue = parseInt(st.value, 10);
    nTrue = Math.min(nTrue, m);
    l1.textContent = 'benchmarks in the suite ' + m;
    l2.textContent = 'benchmarks with a REAL effect ' + nTrue;

    var rnd = mulberry32(31), ps = [], truth = [];
    for (var i = 0; i < m; i++) {
      var isReal = i < nTrue;
      truth.push(isReal);
      // real effects give small p values, nulls give uniform p values
      ps.push(isReal ? Math.pow(rnd(), 6) * 0.05 : rnd());
    }
    var naive = ps.map(function (p) { return p < 0.05; });
    // Benjamini Hochberg
    var order = ps.map(function (p, i) { return [p, i]; }).sort(function (a, b) { return a[0] - b[0]; });
    var maxRank = -1;
    order.forEach(function (o, r) { if (o[0] <= 0.05 * (r + 1) / m) maxRank = r + 1; });
    var bh = new Array(m).fill(false);
    order.forEach(function (o, r) { if (r + 1 <= maxRank) bh[o[1]] = true; });
    // Bonferroni
    var bon = ps.map(function (p) { return p < 0.05 / m; });

    function score(flags) {
      var tp = 0, fp = 0;
      for (var i = 0; i < m; i++) { if (flags[i] && truth[i]) tp++; else if (flags[i] && !truth[i]) fp++; }
      return { tp: tp, fp: fp, missed: nTrue - tp };
    }
    var sN = score(naive), sB = score(bh), sO = score(bon);

    var c = setupCanvas(cv, 200), ctx = c.ctx, pad = { l: 40, r: 14, t: 16, b: 44 };
    axes(ctx, c.w, c.h, pad, '', 'benchmarks flagged', P);
    var groups = [['No correction', sN, P.warn], ['Benjamini Hochberg', sB, P.a3], ['Bonferroni', sO, P.a2]];
    var gw = (c.w - pad.l - pad.r) / groups.length, maxv = Math.max(1, sN.tp + sN.fp);
    groups.forEach(function (g, i) {
      var x = pad.l + i * gw + gw * 0.22, bw = gw * 0.24;
      var hTP = (g[1].tp / maxv) * (c.h - pad.t - pad.b);
      var hFP = (g[1].fp / maxv) * (c.h - pad.t - pad.b);
      ctx.fillStyle = P.a3; ctx.fillRect(x, c.h - pad.b - hTP, bw, hTP);
      ctx.fillStyle = P.warn; ctx.fillRect(x + bw + 5, c.h - pad.b - hFP, bw, hFP);
      ctx.fillStyle = P.muted; ctx.font = '11px ui-sans-serif,system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g[0], pad.l + i * gw + gw / 2, c.h - pad.b + 15);
      ctx.fillText(g[1].tp + ' real / ' + g[1].fp + ' false', pad.l + i * gw + gw / 2, c.h - pad.b + 30);
    });
    ctx.fillStyle = P.a3; ctx.textAlign = 'left';
    ctx.fillText('green = real findings', pad.l + 4, pad.t + 10);
    ctx.fillStyle = P.warn; ctx.fillText('orange = false alarms', pad.l + 4, pad.t + 24);

    out.innerHTML =
      '<b>Run ' + m + ' benchmarks where only ' + nTrue + ' truly moved.</b><br>' +
      'No correction: ' + sN.tp + ' real, <b style="color:' + P.warn + '">' + sN.fp + ' false alarms</b>, ' + sN.missed + ' missed.<br>' +
      'Benjamini Hochberg: ' + sB.tp + ' real, ' + sB.fp + ' false, ' + sB.missed + ' missed.<br>' +
      'Bonferroni: ' + sO.tp + ' real, ' + sO.fp + ' false, <b style="color:' + P.warn + '">' + sO.missed + ' missed</b>.' +
      '<br><span style="color:' + P.muted + '">Bonferroni controls the chance of ANY false alarm and pays for it in missed regressions. For a standing suite that is the wrong trade: a missed regression ships, a false alarm costs an engineer a day.</span>';
  }
  [sm, st].forEach(function (e) { e.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ============ W11: sample size calculator ============ */
function widgetSamplesize(root) {
  var sd = root.querySelector('[data-d]'), ss = root.querySelector('[data-s]'),
      spw = root.querySelector('[data-pw]'), cv = root.querySelector('canvas'),
      out = root.querySelector('[data-out]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]'), l3 = root.querySelector('[data-l3]');
  function need(disc, share, power) {
    var za = 1.96, zb = ninv(power);
    var d = share - 0.5;
    if (d <= 0) return Infinity;
    var nd = Math.pow(za * 0.5 + zb * Math.sqrt(share * (1 - share)), 2) / (d * d);   // one-sample binomial test of the win share among discordant pairs
    return Math.ceil(nd / disc);
  }
  function draw() {
    var P = pal(), disc = parseFloat(sd.value), share = parseFloat(ss.value), power = parseFloat(spw.value);
    l1.textContent = 'discordance rate ' + fmt(disc, 2) + ' (models disagree on ' + Math.round(disc * 100) + '% of tasks)';
    l2.textContent = 'better model wins ' + fmt(share, 2) + ' of disagreements';
    l3.textContent = 'target power ' + fmt(power, 2);
    var n = need(disc, share, power);
    var xs = [0.02, 0.04, 0.06, 0.08, 0.12, 0.16, 0.24, 0.35, 0.5];
    var ys = xs.map(function (d) { return need(d, share, power); });
    var c = setupCanvas(cv, 200), ctx = c.ctx, pad = { l: 52, r: 14, t: 14, b: 34 };
    axes(ctx, c.w, c.h, pad, 'discordance rate (how often models disagree)', 'tasks needed', P);
    var ymax = Math.min(20000, Math.max.apply(null, ys.filter(isFinite)) * 1.1) || 1000;
    function X(v) { return pad.l + (v - 0.02) / (0.5 - 0.02) * (c.w - pad.l - pad.r); }
    function Y(v) { return c.h - pad.b - Math.min(1, v / ymax) * (c.h - pad.t - pad.b); }
    ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.beginPath();
    xs.forEach(function (d, i) { if (i === 0) ctx.moveTo(X(d), Y(ys[i])); else ctx.lineTo(X(d), Y(ys[i])); });
    ctx.stroke();
    ctx.fillStyle = P.a4;
    if (isFinite(n)) { ctx.beginPath(); ctx.arc(X(disc), Y(n), 5, 0, 7); ctx.fill(); }
    ctx.fillStyle = P.muted; ctx.font = '10px ui-sans-serif,system-ui,sans-serif'; ctx.textAlign = 'right';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      ctx.fillText(Math.round(ymax * f), pad.l - 5, c.h - pad.b - f * (c.h - pad.t - pad.b) + 3);
    });
    ctx.textAlign = 'center';
    [0.05, 0.15, 0.3, 0.5].forEach(function (d) { ctx.fillText(fmt(d, 2), X(d), c.h - pad.b + 14); });
    out.innerHTML = '<b>Tasks needed:</b> <b style="color:' + P.accent + '">' +
      (isFinite(n) ? n.toLocaleString() : 'infinite') + '</b>' +
      '<br><span style="color:' + P.muted + '">The curve is a reciprocal: halving the discordance rate doubles the tasks required. As frontier models converge on a fixed task set, discordance falls and this number runs away from you. Generating tasks where models actually differ is the only thing that pushes back.</span>';
  }
  [sd, ss, spw].forEach(function (e) { e.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ============ W12: multiclass confusion heatmap ============ */
function widgetMulticlass(root) {
  var sk = root.querySelector('[data-k]'), sim = root.querySelector('[data-im]'),
      sc = root.querySelector('[data-cf]'), cv = root.querySelector('canvas'),
      out = root.querySelector('[data-out]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]'), l3 = root.querySelector('[data-l3]');
  var NAMES = ['fix bug', 'refactor', 'rename', 'explain', 'add test', 'docs', 'optimize', 'review'];
  function draw() {
    var P = pal(), K = parseInt(sk.value, 10), imb = parseFloat(sim.value), conf = parseFloat(sc.value);
    l1.textContent = 'intent classes ' + K;
    l2.textContent = 'class imbalance ' + fmt(imb, 2);
    l3.textContent = 'confusability of adjacent classes ' + fmt(conf, 2);
    var rnd = mulberry32(29), N = 3000, y = [], p = [];
    var w = [];
    for (var i = 0; i < K; i++) w.push(Math.pow(1 - imb, i) + 0.02);
    var tot = w.reduce(function (a, b) { return a + b; }, 0);
    for (i = 0; i < N; i++) {
      var u = rnd() * tot, acc = 0, lab = 0;
      for (var j = 0; j < K; j++) { acc += w[j]; if (u <= acc) { lab = j; break; } }
      y.push(lab);
      // confusion mostly leaks to the neighbouring class
      var pred = lab;
      if (rnd() < conf) pred = (lab + (rnd() < 0.5 ? 1 : K - 1)) % K;
      else if (rnd() < 0.05) pred = Math.floor(rnd() * K);
      p.push(pred);
    }
    var M = [];
    for (i = 0; i < K; i++) M.push(new Array(K).fill(0));
    for (i = 0; i < N; i++) M[y[i]][p[i]]++;

    var c = setupCanvas(cv, 40 + K * 28), ctx = c.ctx;
    var left = 78, top = 22, cell = Math.min(30, (c.w - left - 14) / K);
    var mx = 0;
    for (i = 0; i < K; i++) for (j = 0; j < K; j++) mx = Math.max(mx, M[i][j]);
    ctx.font = '10px ui-sans-serif,system-ui,sans-serif';
    for (i = 0; i < K; i++) {
      ctx.fillStyle = P.muted; ctx.textAlign = 'right';
      ctx.fillText(NAMES[i].slice(0, 9), left - 5, top + i * cell + cell / 2 + 3);
      ctx.save(); ctx.translate(left + i * cell + cell / 2, top - 6); ctx.rotate(-Math.PI / 5);
      ctx.textAlign = 'left'; ctx.fillText(NAMES[i].slice(0, 7), 0, 0); ctx.restore();
      for (j = 0; j < K; j++) {
        var v = M[i][j], a = mx ? v / mx : 0;
        ctx.fillStyle = (i === j) ? P.a3 : P.warn;
        ctx.globalAlpha = 0.12 + 0.85 * Math.pow(a, 0.55);
        ctx.fillRect(left + j * cell + 1, top + i * cell + 1, cell - 2, cell - 2);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = P.muted; ctx.textAlign = 'left';
    ctx.fillText('rows = true intent, columns = predicted', left, top + K * cell + 14);

    var per = [], macro = 0, weighted = 0, mtp = 0, mfp = 0, mfn = 0;
    for (i = 0; i < K; i++) {
      var tp = M[i][i], fp = 0, fn = 0;
      for (j = 0; j < K; j++) { if (j !== i) { fp += M[j][i]; fn += M[i][j]; } }
      var pr = tp + fp ? tp / (tp + fp) : 0, rc = tp + fn ? tp / (tp + fn) : 0;
      var f1 = pr + rc ? 2 * pr * rc / (pr + rc) : 0;
      var sup = tp + fn;
      per.push({ i: i, f1: f1, sup: sup });
      macro += f1; weighted += f1 * sup; mtp += tp; mfp += fp; mfn += fn;
    }
    macro /= K; weighted /= N;
    var mp = mtp / (mtp + mfp || 1), mr = mtp / (mtp + mfn || 1);
    var micro = mp + mr ? 2 * mp * mr / (mp + mr) : 0;

    var pairs = [];
    for (i = 0; i < K; i++) for (j = 0; j < K; j++) if (i !== j && M[i][j] > 0)
      pairs.push([NAMES[i] + ' &rarr; ' + NAMES[j], M[i][j], M[i][j] / (per[i].sup || 1)]);
    pairs.sort(function (a, b) { return b[1] - a[1]; });

    var gap = weighted - macro;
    out.innerHTML =
      '<b>macro F1</b> ' + fmt(macro, 3) + ' &nbsp; <b>micro F1</b> ' + fmt(micro, 3) +
      ' &nbsp; <b>weighted F1</b> ' + fmt(weighted, 3) +
      ' &nbsp; <b>gap</b> <b style="color:' + (Math.abs(gap) > 0.05 ? P.warn : P.muted) + '">' + fmt(gap, 3) + '</b>' +
      (Math.abs(gap) > 0.05
        ? '<br><span style="color:' + P.warn + '">Weighted is well above macro: your rare intents are performing much worse than the common ones, and the headline number is hiding it.</span>'
        : '<br><span style="color:' + P.muted + '">macro and weighted agree, so performance is roughly even across classes.</span>') +
      '<br><b>Top confused pairs:</b> ' + pairs.slice(0, 3).map(function (x) {
        return x[0] + ' (' + x[1] + ', ' + fmt(x[2] * 100, 1) + '% of that class)';
      }).join(' &middot; ') +
      '<br><span style="color:' + P.muted + '">That list is actionable. The F1 number is not.</span>';
  }
  [sk, sim, sc].forEach(function (e) { e.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ============ W13: selective prediction / auto approve ============ */
function widgetSelective(root) {
  var sq = root.querySelector('[data-q]'), sc = root.querySelector('[data-cov]'),
      sk = root.querySelector('[data-cost]'), cv = root.querySelector('canvas'),
      out = root.querySelector('[data-out]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]'), l3 = root.querySelector('[data-l3]');
  function draw() {
    var P = pal(), q = parseFloat(sq.value), cov = parseFloat(sc.value), askCost = parseFloat(sk.value);
    l1.textContent = 'how well confidence predicts correctness ' + fmt(q, 2);
    l2.textContent = 'coverage (fraction auto approved) ' + fmt(cov, 2);
    l3.textContent = 'cost of asking the user, relative to an error ' + fmt(askCost, 3);
    var rnd = mulberry32(37), N = 4000, correct = [], conf = [];
    for (var i = 0; i < N; i++) {
      var strength = rnd();
      var pCorrect = 0.5 + 0.48 * (q * strength + (1 - q) * rnd());
      var isRight = rnd() < pCorrect;
      correct.push(isRight ? 1 : 0);
      conf.push(q * strength + (1 - q) * rnd());
    }
    var order = conf.map(function (v, i2) { return [v, i2]; }).sort(function (a, b) { return b[0] - a[0]; });
    var covs = [], risks = [];
    for (var f = 0.05; f <= 1.0001; f += 0.05) {
      var k = Math.max(1, Math.round(f * N)), err = 0;
      for (var t = 0; t < k; t++) if (!correct[order[t][1]]) err++;
      covs.push(f); risks.push(err / k);
    }
    var c = setupCanvas(cv, 200), ctx = c.ctx, pad = { l: 46, r: 14, t: 14, b: 34 };
    axes(ctx, c.w, c.h, pad, 'coverage (fraction auto approved)', 'error rate', P);
    var rmax = Math.max.apply(null, risks) * 1.15 || 0.1;
    function X(v) { return pad.l + v * (c.w - pad.l - pad.r); }
    function Y(v) { return c.h - pad.b - (v / rmax) * (c.h - pad.t - pad.b); }
    ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.beginPath();
    covs.forEach(function (v, i3) { if (i3 === 0) ctx.moveTo(X(v), Y(risks[i3])); else ctx.lineTo(X(v), Y(risks[i3])); });
    ctx.stroke();
    var idx = Math.min(covs.length - 1, Math.max(0, Math.round(cov / 0.05) - 1));
    ctx.fillStyle = P.a4; ctx.beginPath(); ctx.arc(X(covs[idx]), Y(risks[idx]), 5.5, 0, 7); ctx.fill();
    ctx.strokeStyle = P.line; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(covs[idx]), pad.t); ctx.lineTo(X(covs[idx]), c.h - pad.b); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = P.muted; ctx.font = '10px ui-sans-serif,system-ui,sans-serif'; ctx.textAlign = 'right';
    [0, 0.5, 1].forEach(function (fr) { ctx.fillText(fmt(rmax * fr, 3), pad.l - 5, Y(rmax * fr) + 3); });
    ctx.textAlign = 'center';
    [0.2, 0.5, 0.8, 1.0].forEach(function (v) { ctx.fillText(fmt(v, 1), X(v), c.h - pad.b + 14); });

    var full = risks[risks.length - 1], here = risks[idx];
    var totalCost = here * cov + askCost * (1 - cov);
    var best = null;
    covs.forEach(function (v, i4) {
      var tc = risks[i4] * v + askCost * (1 - v);
      if (best === null || tc < best.c) best = { c: tc, v: v, r: risks[i4] };
    });
    out.innerHTML =
      '<b>Auto approve everything:</b> error ' + fmt(full, 4) +
      ' &nbsp; <b>at ' + Math.round(cov * 100) + '% coverage:</b> error <b style="color:' + P.a3 + '">' + fmt(here, 4) + '</b>' +
      (here > 0 ? ' (' + fmt(full / here, 1) + 'x better)' : ' (zero errors in the covered set)') +
      '<br><b>Total cost at your setting</b> ' + fmt(totalCost, 4) +
      ' &nbsp; <b>cost minimising coverage</b> <b style="color:' + P.accent + '">' + Math.round(best.v * 100) + '%</b> (cost ' + fmt(best.c, 4) + ')' +
      '<br><span style="color:' + P.muted + '">Drag confidence quality to 0 and the curve goes flat. A flat curve means abstention buys you nothing, and that is itself the finding: fix the confidence signal before tuning the threshold.</span>';
  }
  [sq, sc, sk].forEach(function (e) { e.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ============ W14: judge bias simulator ============ */
function widgetJudge(root) {
  var sp = root.querySelector('[data-pos]'), sl = root.querySelector('[data-len]'),
      ss = root.querySelector('[data-skill]'), sw = root.querySelector('[data-swap]'),
      cv = root.querySelector('canvas'), out = root.querySelector('[data-out]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]'), l3 = root.querySelector('[data-l3]');
  function draw() {
    var P = pal(), pos = parseFloat(sp.value), len = parseFloat(sl.value),
        skill = parseFloat(ss.value), swap = sw.checked;
    l1.textContent = 'position bias ' + fmt(pos, 2);
    l2.textContent = 'length bias ' + fmt(len, 2);
    l3.textContent = 'judge skill ' + fmt(skill, 2);
    var rnd = mulberry32(41), N = 2000, truth = [], verdict = [], inconsistent = 0;
    for (var i = 0; i < N; i++) {
      var aBetter = rnd() < 0.5;                 // ground truth
      var aLonger = rnd() < 0.5;                 // length is independent of quality
      truth.push(aBetter ? 1 : 0);
      function judgeOnce(aFirst) {
        var s = (aBetter ? 1 : -1) * skill;      // real signal
        s += (aFirst ? 1 : -1) * pos;            // prefers whatever is shown first
        s += (aLonger ? 1 : -1) * len;           // prefers the longer answer
        s += (rnd() - 0.5) * 0.8;                // noise
        return s > 0 ? 1 : 0;
      }
      var v;
      if (swap) {
        var f = judgeOnce(true), r = judgeOnce(false);
        if (f === r) v = f; else { v = rnd() < 0.5 ? 1 : 0; inconsistent++; }
      } else v = judgeOnce(true);
      verdict.push(v);
    }
    var tp = 0, fp = 0, fn = 0, tn = 0;
    for (i = 0; i < N; i++) {
      if (truth[i] && verdict[i]) tp++; else if (!truth[i] && verdict[i]) fp++;
      else if (truth[i] && !verdict[i]) fn++; else tn++;
    }
    var agree = (tp + tn) / N;
    var pe = ((tp + fp) * (tp + fn) + (tn + fn) * (tn + fp)) / (N * N);
    var kappa = pe !== 1 ? (agree - pe) / (1 - pe) : 0;
    var aRate = (tp + fp) / N;

    var c = setupCanvas(cv, 150), ctx = c.ctx, pad = { l: 46, r: 14, t: 16, b: 32 };
    axes(ctx, c.w, c.h, pad, '', '', P);
    var bars = [['agreement with truth', agree, P.a3], ['kappa', Math.max(0, kappa), P.a2],
                ['"A wins" rate (0.5 = unbiased)', aRate, Math.abs(aRate - 0.5) > 0.06 ? P.warn : P.muted]];
    var bh = (c.h - pad.t - pad.b) / bars.length;
    bars.forEach(function (b, i2) {
      var y = pad.t + i2 * bh + 5, w = (c.w - pad.l - pad.r) * Math.min(1, b[1]);
      ctx.fillStyle = b[2]; ctx.fillRect(pad.l, y, w, bh - 16);
      ctx.fillStyle = P.muted; ctx.font = '11px ui-sans-serif,system-ui,sans-serif';
      ctx.textAlign = 'left'; ctx.fillText(b[0] + '  ' + fmt(b[1], 3), pad.l + 5, y + bh - 22);
    });
    ctx.strokeStyle = P.ink; ctx.setLineDash([3, 3]);
    var mid = pad.l + (c.w - pad.l - pad.r) * 0.5;
    ctx.beginPath(); ctx.moveTo(mid, pad.t); ctx.lineTo(mid, c.h - pad.b); ctx.stroke(); ctx.setLineDash([]);

    out.innerHTML =
      '<b>Agreement</b> ' + fmt(agree, 3) + ' &nbsp; <b>kappa</b> ' + fmt(kappa, 3) +
      ' &nbsp; <b>"A wins" rate</b> <b style="color:' + (Math.abs(aRate - 0.5) > 0.06 ? P.warn : P.a3) + '">' + fmt(aRate, 3) + '</b>' +
      (swap ? '<br>Order swapping ON. Inconsistent verdicts: <b>' + fmt(inconsistent / N, 3) +
              '</b> of pairs flipped when the order flipped. <span style="color:' + P.muted +
              '">That rate is a direct measurement of position bias, and it is worth reporting on its own.</span>'
            : '<br><span style="color:' + P.warn + '">Order swapping OFF. Turn it on and watch the "A wins" rate move back toward 0.5 while agreement barely changes. The bias was inflating your confidence, not your accuracy.</span>');
  }
  [sp, sl, ss].forEach(function (e) { e.addEventListener('input', draw); });
  sw.addEventListener('change', draw);
  root._draw = draw; draw();
}

/* ============ W15: offline vs online gap fit ============ */
function widgetGapfit(root) {
  var sn = root.querySelector('[data-n]'), ssl = root.querySelector('[data-slope]'),
      sns = root.querySelector('[data-noise]'), cv = root.querySelector('canvas'),
      out = root.querySelector('[data-out]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]'), l3 = root.querySelector('[data-l3]');
  function fit(xs, ys) {
    var n = xs.length, mx = mean(xs), my = mean(ys), sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
    var a = sxx ? sxy / sxx : 0;
    return { a: a, b: my - a * mx };
  }
  function draw() {
    var P = pal(), n = parseInt(sn.value, 10), slope = parseFloat(ssl.value), noise = parseFloat(sns.value);
    l1.textContent = 'past releases you can fit on ' + n;
    l2.textContent = 'true shrinkage: online move / offline move ' + fmt(slope, 2);
    l3.textContent = 'noise ' + fmt(noise, 3);
    var rnd = mulberry32(43), off = [], on = [];
    function g() { var u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    for (var i = 0; i < n; i++) {
      var o = (rnd() - 0.35) * 0.12;
      off.push(o); on.push(slope * o + noise * g());
    }
    var F = fit(off, on);
    // leave one out backtest
    var errs = [], signHits = 0;
    for (i = 0; i < n; i++) {
      var xs = off.slice(0, i).concat(off.slice(i + 1)), ys = on.slice(0, i).concat(on.slice(i + 1));
      var f2 = fit(xs, ys), pred = f2.a * off[i] + f2.b;
      errs.push(Math.abs(pred - on[i]));
      if ((pred > 0) === (on[i] > 0)) signHits++;
    }
    var mae = mean(errs), worst = Math.max.apply(null, errs), dirAcc = signHits / n;

    var c = setupCanvas(cv, 220), ctx = c.ctx, pad = { l: 50, r: 14, t: 14, b: 36 };
    axes(ctx, c.w, c.h, pad, 'offline delta', 'online delta', P);
    var lim = 0.1;
    function X(v) { return pad.l + (v + lim) / (2 * lim) * (c.w - pad.l - pad.r); }
    function Y(v) { return c.h - pad.b - (v + lim) / (2 * lim) * (c.h - pad.t - pad.b); }
    ctx.strokeStyle = P.line; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(-lim), Y(-lim)); ctx.lineTo(X(lim), Y(lim)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(-lim), Y(0)); ctx.lineTo(X(lim), Y(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(0), Y(-lim)); ctx.lineTo(X(0), Y(lim)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = P.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(-lim), Y(F.a * -lim + F.b)); ctx.lineTo(X(lim), Y(F.a * lim + F.b)); ctx.stroke();
    for (i = 0; i < n; i++) {
      var wrongSign = (off[i] > 0) !== (on[i] > 0);
      ctx.fillStyle = wrongSign ? P.warn : P.a3;
      ctx.beginPath(); ctx.arc(X(off[i]), Y(on[i]), 4, 0, 7); ctx.fill();
    }
    ctx.fillStyle = P.muted; ctx.font = '10px ui-sans-serif,system-ui,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('grey diagonal = offline predicts online exactly', pad.l + 5, pad.t + 11);
    ctx.fillStyle = P.warn; ctx.fillText('orange = offline said better, online said worse (or vice versa)', pad.l + 5, pad.t + 24);

    out.innerHTML =
      '<b>Fitted slope</b> ' + fmt(F.a, 3) + ' &nbsp; <b>shrinkage</b> ' + fmt(1 - F.a, 3) +
      ' &nbsp; <b>leave-one-out MAE</b> <b style="color:' + P.accent + '">' + fmt(mae, 4) + '</b>' +
      '<br><b>Direction accuracy</b> <b style="color:' + (dirAcc < 0.8 ? P.warn : P.a3) + '">' + fmt(dirAcc, 3) +
      '</b> &nbsp; <b>worst single miss</b> ' + fmt(worst, 4) +
      '<br><span style="color:' + P.muted + '">Direction accuracy is the number that matters for a ship decision: MAE can look small while the suite still points the wrong way on the releases you cared about. Drop the release count to 6 and watch the leave-one-out error jump, which is what overfitting a handful of releases actually looks like.</span>';
  }
  [sn, ssl, sns].forEach(function (e) { e.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ============ W16: harness simulator ============ */
function widgetHarness(root) {
  var scc = root.querySelector('[data-conc]'), sf = root.querySelector('[data-fail]'),
      sr = root.querySelector('[data-retry]'), cv = root.querySelector('canvas'),
      out = root.querySelector('[data-out]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]'), l3 = root.querySelector('[data-l3]');
  function draw() {
    var P = pal(), conc = parseInt(scc.value, 10), fail = parseFloat(sf.value), maxAtt = parseInt(sr.value, 10);
    l1.textContent = 'concurrency ' + conc;
    l2.textContent = 'transient failure rate ' + fmt(fail, 2);
    l3.textContent = 'max attempts ' + maxAtt;
    var rnd = mulberry32(47), N = 1000, truePass = 0.60;
    var lat = [], attempts = [], passed = 0, retried = 0, lost = 0;
    for (var i = 0; i < N; i++) {
      var att = 0, done = false, t = 0;
      while (att < maxAtt && !done) {
        att++;
        t += 2 + 4 * rnd();
        if (rnd() < fail) { t += Math.min(20, 0.5 * Math.pow(2, att)); continue; }
        done = true;
      }
      if (!done) { lost++; attempts.push(att); lat.push(t); continue; }
      if (att > 1) retried++;
      // each attempt is an independent draw at the task, so retries add samples
      var ok = false;
      for (var k = 0; k < att; k++) if (rnd() < truePass) { ok = true; break; }
      if (ok) passed++;
      attempts.push(att); lat.push(t);
    }
    var scored = N - lost;
    var observed = passed / (scored || 1);
    var wall = lat.reduce(function (a, b) { return a + b; }, 0) / conc;
    var ci = wilson(passed, scored);

    var c = setupCanvas(cv, 180), ctx = c.ctx, pad = { l: 46, r: 14, t: 16, b: 34 };
    axes(ctx, c.w, c.h, pad, 'concurrency', 'wall clock (relative)', P);
    var ccs = [1, 2, 4, 8, 16, 32, 64, 128];
    var total = lat.reduce(function (a, b) { return a + b; }, 0);
    function X(v) { return pad.l + (Math.log(v) / Math.log(128)) * (c.w - pad.l - pad.r); }
    var ymax = total / 1;
    function Y(v) { return c.h - pad.b - (1 - Math.min(1, v / ymax)) * 0 - (v / ymax) * (c.h - pad.t - pad.b); }
    ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.beginPath();
    ccs.forEach(function (cc, i2) {
      var wc = total / cc + cc * 0.35;   // Amdahl-ish: coordination cost grows with concurrency
      if (i2 === 0) ctx.moveTo(X(cc), Y(wc)); else ctx.lineTo(X(cc), Y(wc));
    });
    ctx.stroke();
    var wcNow = total / conc + conc * 0.35;
    ctx.fillStyle = P.a4; ctx.beginPath(); ctx.arc(X(conc), Y(wcNow), 5, 0, 7); ctx.fill();
    ctx.fillStyle = P.muted; ctx.font = '10px ui-sans-serif,system-ui,sans-serif'; ctx.textAlign = 'center';
    ccs.forEach(function (cc) { ctx.fillText(String(cc), X(cc), c.h - pad.b + 14); });

    var inflation = observed - truePass;
    out.innerHTML =
      '<b>True per attempt pass rate is 0.600.</b> Your harness reports <b style="color:' +
      (inflation > 0.02 ? P.warn : P.a3) + '">' + fmt(observed, 3) + '</b> ' +
      '(95% CI [' + fmt(ci[0], 3) + ', ' + fmt(ci[1], 3) + ']).' +
      '<br>' + retried + ' tasks retried, ' + lost + ' tasks exhausted all attempts and were dropped from scoring.' +
      (inflation > 0.02
        ? '<br><span style="color:' + P.warn + '"><b>Retries inflated the score by ' + fmt(inflation, 3) +
          '.</b> A retried task got more than one shot at the answer, so it was effectively scored at pass@k with a larger k than the tasks that succeeded first time. Record attempts and report the score with and without retried tasks.</span>'
        : '<br><span style="color:' + P.a3 + '">Retry inflation is negligible at this failure rate.</span>') +
      (lost > 0 ? '<br><span style="color:' + P.warn + '">' + lost +
        ' dropped tasks are silently excluded from the denominator. If failures correlate with difficulty, dropping them biases the score upward.</span>' : '') +
      '<br><span style="color:' + P.muted + '">Wall clock at concurrency ' + conc + ': ' + fmt(wcNow, 1) +
      ' units. Push concurrency high enough and coordination overhead outweighs the parallelism.</span>';
  }
  [scc, sf, sr].forEach(function (e) { e.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* register batch two */
var EXTRA_WIDGETS = {
  mcnemar: widgetMcnemar, multcomp: widgetMultcomp, samplesize: widgetSamplesize,
  multiclass: widgetMulticlass, selective: widgetSelective, judge: widgetJudge,
  gapfit: widgetGapfit, harness: widgetHarness
};

/* ---------- tiny helpers ---------- */
function css(name, fallback) {
  var v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v && v.trim()) || fallback;
}
function pal() {
  return {
    ink: css('--ink', '#1c1b19'),
    muted: css('--muted', '#666'),
    line: css('--line', '#ddd'),
    accent: css('--accent', '#b4553a'),
    a2: css('--eli5-line', '#4a72a0'),
    a3: css('--ask-line', '#6f8f6f'),
    a4: css('--adv-line', '#7a5f96'),
    warn: css('--warn-line', '#d99a4e'),
    panel: css('--panel', '#fff'),
    code: css('--code-bg', '#f4f2ee')
  };
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function erf(x) {
  var s = x < 0 ? -1 : 1; x = Math.abs(x);
  var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
      a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  var t = 1 / (1 + p * x);
  var y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return s * y;
}
function ncdf(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
function ninv(p) {
  if (p <= 0) return -6; if (p >= 1) return 6;
  var lo = -6, hi = 6;
  for (var i = 0; i < 80; i++) { var m = (lo + hi) / 2; if (ncdf(m) < p) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function quantile(sorted, q) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];
}
function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
function fmt(x, d) { d = d === undefined ? 3 : d; return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }

function wilson(k, n, z) {
  z = z || 1.96;
  if (n === 0) return [0, 1];
  var p = k / n, den = 1 + z * z / n;
  var c = (p + z * z / (2 * n)) / den;
  var m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  return [Math.max(0, c - m), Math.min(1, c + m)];
}
function normalCI(k, n, z) {
  z = z || 1.96; var p = k / n;
  var m = z * Math.sqrt(p * (1 - p) / n);
  return [p - m, p + m];
}

/* canvas setup with device pixel ratio */
function setupCanvas(cv, h) {
  var dpr = window.devicePixelRatio || 1;
  var w = cv.parentElement.clientWidth || 640;
  cv.style.width = '100%'; cv.style.height = h + 'px';
  cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
  var ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx: ctx, w: w, h: h };
}
function axes(ctx, w, h, pad, xlab, ylab, P) {
  ctx.strokeStyle = P.line; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b);
  ctx.stroke();
  ctx.fillStyle = P.muted; ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  if (xlab) { ctx.textAlign = 'center'; ctx.fillText(xlab, (pad.l + w - pad.r) / 2, h - 4); }
  if (ylab) {
    ctx.save(); ctx.translate(11, (pad.t + h - pad.b) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.fillText(ylab, 0, 0); ctx.restore();
  }
}
function histogram(ctx, data, pad, w, h, bins, color, P, xmaxOverride) {
  var xmax = xmaxOverride || Math.max.apply(null, data);
  var xmin = 0;
  var counts = new Array(bins).fill(0);
  data.forEach(function (v) {
    var b = Math.min(bins - 1, Math.max(0, Math.floor((v - xmin) / (xmax - xmin) * bins)));
    counts[b]++;
  });
  var cmax = Math.max.apply(null, counts) || 1;
  var pw = (w - pad.l - pad.r) / bins;
  ctx.fillStyle = color;
  for (var i = 0; i < bins; i++) {
    var bh = (counts[i] / cmax) * (h - pad.t - pad.b);
    ctx.fillRect(pad.l + i * pw + 0.5, h - pad.b - bh, Math.max(1, pw - 1), bh);
  }
  return { xmin: xmin, xmax: xmax };
}
function vline(ctx, x, pad, w, h, xmin, xmax, color, label, P, dy) {
  var px = pad.l + (x - xmin) / (xmax - xmin) * (w - pad.l - pad.r);
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px, pad.t); ctx.lineTo(px, h - pad.b); ctx.stroke();
  if (label) {
    ctx.fillStyle = color; ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText(label, Math.min(px + 4, w - 60), pad.t + 12 + (dy || 0));
  }
}

/* ---------- W1: distribution explorer ---------- */
function sampleDist(kind, p1, p2, n, rnd) {
  var out = [], i;
  function gauss() {
    var u = 1 - rnd(), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function pois(l) {
    var L = Math.exp(-l), k = 0, pp = 1;
    do { k++; pp *= rnd(); } while (pp > L);
    return k - 1;
  }
  for (i = 0; i < n; i++) {
    if (kind === 'normal') out.push(p1 + p2 * gauss());
    else if (kind === 'lognormal') out.push(Math.exp(Math.log(Math.max(0.01, p1)) + p2 * gauss()));
    else if (kind === 'binomial') { var c = 0; for (var j = 0; j < p1; j++) if (rnd() < p2) c++; out.push(c); }
    else if (kind === 'poisson') out.push(pois(p1));
    else { /* negative binomial via gamma-poisson */
      var g = 0; for (var r = 0; r < Math.max(1, Math.round(p1)); r++) g += -Math.log(1 - rnd());
      out.push(pois(g * p2));
    }
  }
  return out;
}
function widgetDist(root) {
  var kind = root.querySelector('[data-k]'), s1 = root.querySelector('[data-p1]'),
      s2 = root.querySelector('[data-p2]'), cv = root.querySelector('canvas'),
      out = root.querySelector('[data-out]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]');
  function draw() {
    var P = pal(), K = kind.value;
    var p1 = parseFloat(s1.value), p2 = parseFloat(s2.value);
    var labels = {
      normal: ['mean', 'sd'], lognormal: ['median scale', 'log sd'],
      binomial: ['trials n', 'prob p'], poisson: ['lambda', '(unused)'],
      negbin: ['shape r', 'rate scale']
    }[K];
    l1.textContent = labels[0] + ' ' + p1;
    l2.textContent = labels[1] + ' ' + p2;
    var data = sampleDist(K, p1, p2, 4000, mulberry32(42));
    var sorted = data.slice().sort(function (a, b) { return a - b; });
    var c = setupCanvas(cv, 210), ctx = c.ctx;
    var pad = { l: 34, r: 12, t: 14, b: 30 };
    axes(ctx, c.w, c.h, pad, 'value', 'count', P);
    var xmax = quantile(sorted, 0.995) * 1.05;
    var r = histogram(ctx, data.filter(function (v) { return v <= xmax; }), pad, c.w, c.h, 46, P.line, P, xmax);
    var mu = mean(data), md = quantile(sorted, 0.5), p95 = quantile(sorted, 0.95);
    vline(ctx, md, pad, c.w, c.h, r.xmin, r.xmax, P.a3, 'median', P, 0);
    vline(ctx, mu, pad, c.w, c.h, r.xmin, r.xmax, P.accent, 'mean', P, 14);
    vline(ctx, p95, pad, c.w, c.h, r.xmin, r.xmax, P.a4, 'p95', P, 28);
    var ratio = mu / (md || 1);
    var vari = data.reduce(function (a, x) { return a + (x - mu) * (x - mu); }, 0) / (data.length - 1);
    out.innerHTML =
      '<b>mean</b> ' + fmt(mu, 2) + ' &nbsp; <b>median</b> ' + fmt(md, 2) +
      ' &nbsp; <b>p95</b> ' + fmt(p95, 2) + ' &nbsp; <b>var/mean</b> ' + fmt(vari / (mu || 1), 2) +
      '<br><b>skew ratio (mean/median)</b> ' + fmt(ratio, 2) + ' &mdash; ' +
      (ratio > 1.2
        ? '<span style="color:' + P.warn + '"><b>do not report the mean.</b> Use median and percentiles.</span>'
        : '<span style="color:' + P.a3 + '">mean is a fair summary here.</span>') +
      (vari / (mu || 1) > 1.5 && (K === 'poisson' || K === 'negbin')
        ? '<br><span style="color:' + P.warn + '">variance/mean &gt; 1.5: overdispersed, Poisson intervals will be too narrow.</span>' : '');
  }
  [kind, s1, s2].forEach(function (el) { el.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ---------- W2: CI comparator + coverage ---------- */
function widgetCI(root) {
  var sp = root.querySelector('[data-p]'), sn = root.querySelector('[data-n]'),
      cv = root.querySelector('canvas'), out = root.querySelector('[data-out]'),
      lp = root.querySelector('[data-lp]'), ln = root.querySelector('[data-ln]');
  function draw() {
    var P = pal(), p = parseFloat(sp.value), n = parseInt(sn.value, 10);
    lp.textContent = 'true rate ' + fmt(p, 2); ln.textContent = 'n = ' + n;
    var rnd = mulberry32(7), trials = 3000, hw = 0, hnv = 0;
    for (var t = 0; t < trials; t++) {
      var k = 0; for (var i = 0; i < n; i++) if (rnd() < p) k++;
      var a = wilson(k, n), b = normalCI(k, n);
      if (a[0] <= p && p <= a[1]) hw++;
      if (b[0] <= p && p <= b[1]) hnv++;
    }
    var kObs = Math.round(p * n);
    var w = wilson(kObs, n), nv = normalCI(kObs, n);
    var c = setupCanvas(cv, 150), ctx = c.ctx, pad = { l: 40, r: 14, t: 18, b: 30 };
    axes(ctx, c.w, c.h, pad, 'proportion', '', P);
    function bar(iv, y, color, name) {
      var x0 = pad.l + Math.max(0, iv[0]) * (c.w - pad.l - pad.r);
      var x1 = pad.l + Math.min(1.05, iv[1]) * (c.w - pad.l - pad.r);
      ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillStyle = color; ctx.font = '600 11px ui-sans-serif,system-ui,sans-serif';
      ctx.textAlign = 'left'; ctx.fillText(name, pad.l, y - 10);
    }
    bar(w, pad.t + 26, P.a3, 'Wilson');
    bar(nv, pad.t + 72, P.warn, 'Normal approximation');
    var px = pad.l + p * (c.w - pad.l - pad.r);
    ctx.strokeStyle = P.ink; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, pad.t); ctx.lineTo(px, c.h - pad.b); ctx.stroke();
    ctx.setLineDash([]);
    var cw = hw / trials, cn = hnv / trials;
    out.innerHTML =
      '<b>Actual coverage over 3000 simulated runs</b><br>' +
      'Wilson <b style="color:' + P.a3 + '">' + fmt(cw, 3) + '</b> &nbsp;&nbsp; ' +
      'Normal <b style="color:' + (cn < 0.9 ? P.warn : P.a3) + '">' + fmt(cn, 3) + '</b>' +
      '<br>Nominal is 0.950. ' +
      (cn < 0.90 ? '<span style="color:' + P.warn + '">The normal approximation is not delivering a 95% interval here.</span>'
                 : 'Both are acceptable at this rate and sample size.') +
      (nv[1] > 1 ? '<br><span style="color:' + P.warn + '">Normal upper bound exceeds 1.0, which is impossible.</span>' : '');
  }
  [sp, sn].forEach(function (el) { el.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ---------- W3: power and sample size ---------- */
function widgetPower(root) {
  var sb = root.querySelector('[data-b]'), se = root.querySelector('[data-e]'),
      sr = root.querySelector('[data-r]'), cv = root.querySelector('canvas'),
      out = root.querySelector('[data-out]'),
      lb = root.querySelector('[data-lb]'), le = root.querySelector('[data-le]'), lr = root.querySelector('[data-lr]');
  function powerAt(base, eff, n, rho, rnd, trials) {
    var hits = 0;
    for (var t = 0; t < trials; t++) {
      var b = 0, cc = 0;
      for (var i = 0; i < n; i++) {
        var shared = rnd() < rho, a1, b1;
        if (shared) { var u = rnd(); a1 = u < base + eff ? 1 : 0; b1 = u < base ? 1 : 0; }
        else { a1 = rnd() < base + eff ? 1 : 0; b1 = rnd() < base ? 1 : 0; }
        if (a1 === 1 && b1 === 0) b++; else if (a1 === 0 && b1 === 1) cc++;
      }
      var nd = b + cc;
      if (nd > 0) {
        var z = (b - cc) / Math.sqrt(nd);
        if (Math.abs(z) > 1.96) hits++;
      }
    }
    return hits / trials;
  }
  function draw() {
    var P = pal(), base = parseFloat(sb.value), eff = parseFloat(se.value), rho = parseFloat(sr.value);
    lb.textContent = 'base rate ' + fmt(base, 2);
    le.textContent = 'true effect ' + fmt(eff, 3);
    lr.textContent = 'model agreement ' + fmt(rho, 2);
    var ns = [50, 100, 200, 400, 800, 1600, 3200], pts = [];
    ns.forEach(function (n) { pts.push([n, powerAt(base, eff, n, rho, mulberry32(3), 260)]); });
    var c = setupCanvas(cv, 210), ctx = c.ctx, pad = { l: 42, r: 14, t: 14, b: 34 };
    axes(ctx, c.w, c.h, pad, 'tasks (log scale)', 'power', P);
    function X(n) { return pad.l + (Math.log(n) - Math.log(50)) / (Math.log(3200) - Math.log(50)) * (c.w - pad.l - pad.r); }
    function Y(p) { return c.h - pad.b - p * (c.h - pad.t - pad.b); }
    ctx.strokeStyle = P.line; ctx.setLineDash([3, 3]); ctx.beginPath();
    ctx.moveTo(pad.l, Y(0.8)); ctx.lineTo(c.w - pad.r, Y(0.8)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = P.muted; ctx.font = '10px ui-sans-serif,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('80% power', pad.l + 4, Y(0.8) - 4);
    ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.beginPath();
    pts.forEach(function (pt, i) { if (i === 0) ctx.moveTo(X(pt[0]), Y(pt[1])); else ctx.lineTo(X(pt[0]), Y(pt[1])); });
    ctx.stroke();
    ctx.fillStyle = P.accent;
    pts.forEach(function (pt) { ctx.beginPath(); ctx.arc(X(pt[0]), Y(pt[1]), 3, 0, 7); ctx.fill(); });
    ctx.fillStyle = P.muted; ctx.textAlign = 'center';
    ns.forEach(function (n) { ctx.fillText(String(n), X(n), c.h - pad.b + 14); });
    var need = null;
    for (var i = 0; i < pts.length; i++) if (pts[i][1] >= 0.8) { need = pts[i][0]; break; }
    out.innerHTML = '<b>Tasks needed for 80% power:</b> ' +
      (need ? '&asymp; <b style="color:' + P.accent + '">' + need + '</b>'
            : '<span style="color:' + P.warn + '">more than 3200.</span> An effect this small on models that agree this often is not detectable at any realistic suite size.') +
      '<br><span style="color:' + P.muted + '">Raise model agreement and the pairing helps you. Shrink the effect and cost explodes: power scales with the square of the effect.</span>';
  }
  [sb, se, sr].forEach(function (el) { el.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ---------- W4: bootstrap visualizer ---------- */
function widgetBoot(root) {
  var st = root.querySelector('[data-stat]'), sn = root.querySelector('[data-n]'),
      sk = root.querySelector('[data-skew]'),
      cv = root.querySelector('canvas'), out = root.querySelector('[data-out]'),
      ln = root.querySelector('[data-ln]'), lk = root.querySelector('[data-lk]');
  function statOf(a, kind) {
    var s = a.slice().sort(function (x, y) { return x - y; });
    if (kind === 'mean') return mean(a);
    if (kind === 'median') return quantile(s, 0.5);
    if (kind === 'p95') return quantile(s, 0.95);
    return s[s.length - 1];
  }
  function draw() {
    var P = pal(), n = parseInt(sn.value, 10), skew = parseFloat(sk.value), kind = st.value;
    ln.textContent = 'n = ' + n; lk.textContent = 'skew (log sd) ' + fmt(skew, 2);
    var rnd = mulberry32(11);
    var data = sampleDist('lognormal', 2, skew, n, rnd);
    var reps = [], iters = 2500;
    for (var t = 0; t < iters; t++) {
      var s = []; for (var i = 0; i < n; i++) s.push(data[Math.floor(rnd() * n)]);
      reps.push(statOf(s, kind));
    }
    reps.sort(function (a, b) { return a - b; });
    var lo = quantile(reps, 0.025), hi = quantile(reps, 0.975), obs = statOf(data, kind);
    var c = setupCanvas(cv, 200), ctx = c.ctx, pad = { l: 36, r: 14, t: 14, b: 30 };
    axes(ctx, c.w, c.h, pad, 'bootstrap value of the statistic', 'count', P);
    var xmax = quantile(reps, 0.999) * 1.05;
    var r = histogram(ctx, reps.filter(function (v) { return v <= xmax; }), pad, c.w, c.h, 44, P.line, P, xmax);
    vline(ctx, obs, pad, c.w, c.h, r.xmin, r.xmax, P.accent, 'observed', P, 0);
    vline(ctx, lo, pad, c.w, c.h, r.xmin, r.xmax, P.a2, '2.5%', P, 16);
    vline(ctx, hi, pad, c.w, c.h, r.xmin, r.xmax, P.a2, '97.5%', P, 32);
    var width = hi - lo, rel = width / (obs || 1);
    var warn = '';
    if (kind === 'p95' && n < 200) warn = 'p95 on n=' + n + ' rests on a handful of points. The bootstrap cannot exceed your observed maximum, so the upper bound is censored.';
    if (kind === 'max') warn = 'The bootstrap is INCONSISTENT for maxima. This interval is not valid at any n. Use extreme value theory or change the metric.';
    if (n < 20) warn = 'n < 20: the resamples only contain values you already saw. Use an exact method instead.';
    out.innerHTML = '<b>' + kind + '</b> = ' + fmt(obs, 3) +
      ' &nbsp; <b>95% CI</b> [' + fmt(lo, 3) + ', ' + fmt(hi, 3) + '] &nbsp; width ' + fmt(width, 3) +
      ' (' + fmt(rel * 100, 1) + '% of the estimate)' +
      (warn ? '<br><span style="color:' + P.warn + '"><b>Watch out:</b> ' + warn + '</span>' : '');
  }
  [st, sn, sk].forEach(function (el) { el.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ---------- W5: classification playground ---------- */
function widgetClf(root) {
  var ssep = root.querySelector('[data-sep]'), sprev = root.querySelector('[data-prev]'),
      sthr = root.querySelector('[data-thr]'), scost = root.querySelector('[data-cost]'),
      cvA = root.querySelector('[data-cv=dist]'), cvB = root.querySelector('[data-cv=curves]'),
      out = root.querySelector('[data-out]'), grid = root.querySelector('[data-grid]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]'),
      l3 = root.querySelector('[data-l3]'), l4 = root.querySelector('[data-l4]');
  function build(sep, prev) {
    var rnd = mulberry32(5), N = 4000, y = [], s = [];
    function gauss() { var u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    for (var i = 0; i < N; i++) {
      var pos = rnd() < prev;
      y.push(pos ? 1 : 0);
      var m = pos ? 0.5 + sep / 2 : 0.5 - sep / 2;
      s.push(Math.min(0.999, Math.max(0.001, m + 0.16 * gauss())));
    }
    return { y: y, s: s };
  }
  function draw() {
    var P = pal(), sep = parseFloat(ssep.value), prev = parseFloat(sprev.value),
        thr = parseFloat(sthr.value), costRatio = parseFloat(scost.value);
    l1.textContent = 'separation ' + fmt(sep, 2);
    l2.textContent = 'prevalence ' + fmt(prev, 3);
    l3.textContent = 'threshold ' + fmt(thr, 2);
    l4.textContent = 'cost(miss)/cost(false alarm) ' + fmt(costRatio, 1);
    var D = build(sep, prev), y = D.y, s = D.s;
    var tp = 0, fp = 0, fn = 0, tn = 0;
    for (var i = 0; i < y.length; i++) {
      var p = s[i] >= thr ? 1 : 0;
      if (y[i] === 1 && p === 1) tp++; else if (y[i] === 0 && p === 1) fp++;
      else if (y[i] === 1 && p === 0) fn++; else tn++;
    }
    var n = y.length;
    var acc = (tp + tn) / n;
    var prec = tp + fp ? tp / (tp + fp) : 0;
    var rec = tp + fn ? tp / (tp + fn) : 0;
    var spec = tn + fp ? tn / (tn + fp) : 0;
    var f1 = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
    var bacc = (rec + spec) / 2;
    var den = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
    var mcc = den ? (tp * tn - fp * fn) / den : 0;
    var pe = ((tp + fp) * (tp + fn) + (tn + fn) * (tn + fp)) / (n * n);
    var kappa = pe !== 1 ? (acc - pe) / (1 - pe) : 0;
    var ecost = (fp * 1 + fn * costRatio) / n;

    /* score distributions */
    var c1 = setupCanvas(cvA, 160), x1 = c1.ctx, pad = { l: 34, r: 12, t: 12, b: 28 };
    axes(x1, c1.w, c1.h, pad, 'model score', 'count', P);
    function hist(vals, color) {
      var bins = 44, counts = new Array(bins).fill(0);
      vals.forEach(function (v) { counts[Math.min(bins - 1, Math.floor(v * bins))]++; });
      var cmax = Math.max.apply(null, counts) || 1;
      var pw = (c1.w - pad.l - pad.r) / bins;
      x1.fillStyle = color;
      for (var b = 0; b < bins; b++) {
        var bh = (counts[b] / cmax) * (c1.h - pad.t - pad.b);
        x1.fillRect(pad.l + b * pw, c1.h - pad.b - bh, Math.max(1, pw - 1), bh);
      }
    }
    hist(s.filter(function (_, i) { return y[i] === 0; }), P.line);
    hist(s.filter(function (_, i) { return y[i] === 1; }), P.a3);
    var tx = pad.l + thr * (c1.w - pad.l - pad.r);
    x1.strokeStyle = P.accent; x1.lineWidth = 2;
    x1.beginPath(); x1.moveTo(tx, pad.t); x1.lineTo(tx, c1.h - pad.b); x1.stroke();
    x1.fillStyle = P.muted; x1.font = '10px ui-sans-serif,system-ui,sans-serif'; x1.textAlign = 'left';
    x1.fillText('negatives', pad.l + 4, pad.t + 10);
    x1.fillStyle = P.a3; x1.fillText('positives', pad.l + 4, pad.t + 22);

    /* ROC + PR */
    var order = s.map(function (v, i) { return [v, y[i]]; }).sort(function (a, b) { return b[0] - a[0]; });
    var totP = tp + fn, totN = fp + tn, ctp = 0, cfp = 0, roc = [[0, 0]], pr = [], auc = 0, ap = 0, prevX = 0;
    for (var k = 0; k < order.length; k++) {
      if (order[k][1] === 1) { ctp++; ap += ctp / (k + 1); } else cfp++;
      var tpr = totP ? ctp / totP : 0, fpr = totN ? cfp / totN : 0;
      roc.push([fpr, tpr]);
      pr.push([tpr, ctp / (k + 1)]);
    }
    for (var q = 1; q < roc.length; q++) auc += (roc[q][0] - roc[q - 1][0]) * (roc[q][1] + roc[q - 1][1]) / 2;
    ap = totP ? ap / totP : 0;

    var c2 = setupCanvas(cvB, 210), x2 = c2.ctx;
    var half = (c2.w - 24) / 2, p2 = { l: 34, r: 8, t: 12, b: 28 };
    function plot(pts, ox, title, diag, base) {
      x2.strokeStyle = P.line; x2.lineWidth = 1;
      x2.beginPath();
      x2.moveTo(ox + p2.l, p2.t); x2.lineTo(ox + p2.l, c2.h - p2.b);
      x2.lineTo(ox + half - p2.r, c2.h - p2.b); x2.stroke();
      var pw = half - p2.l - p2.r, ph = c2.h - p2.t - p2.b;
      if (diag) {
        x2.setLineDash([3, 3]); x2.strokeStyle = P.muted; x2.beginPath();
        x2.moveTo(ox + p2.l, c2.h - p2.b); x2.lineTo(ox + p2.l + pw, p2.t); x2.stroke(); x2.setLineDash([]);
      }
      if (base !== undefined) {
        x2.setLineDash([3, 3]); x2.strokeStyle = P.warn; x2.beginPath();
        x2.moveTo(ox + p2.l, c2.h - p2.b - base * ph);
        x2.lineTo(ox + p2.l + pw, c2.h - p2.b - base * ph); x2.stroke(); x2.setLineDash([]);
      }
      x2.strokeStyle = P.accent; x2.lineWidth = 2; x2.beginPath();
      pts.forEach(function (pt, i) {
        var X = ox + p2.l + pt[0] * pw, Y = c2.h - p2.b - pt[1] * ph;
        if (i === 0) x2.moveTo(X, Y); else x2.lineTo(X, Y);
      });
      x2.stroke();
      x2.fillStyle = P.muted; x2.font = '11px ui-sans-serif,system-ui,sans-serif';
      x2.textAlign = 'left'; x2.fillText(title, ox + p2.l, c2.h - 6);
      return { ox: ox, pw: pw, ph: ph };
    }
    var g1 = plot(roc, 0, 'ROC  (AUC ' + fmt(auc, 3) + ')', true);
    var g2 = plot(pr, half + 24, 'PR  (AP ' + fmt(ap, 3) + ', baseline ' + fmt(prev, 3) + ')', false, prev);
    /* operating point markers */
    var fprNow = totN ? fp / totN : 0;
    x2.fillStyle = P.a4;
    x2.beginPath(); x2.arc(g1.ox + p2.l + fprNow * g1.pw, c2.h - p2.b - rec * g1.ph, 4.5, 0, 7); x2.fill();
    x2.beginPath(); x2.arc(g2.ox + p2.l + rec * g2.pw, c2.h - p2.b - prec * g2.ph, 4.5, 0, 7); x2.fill();

    /* confusion heatmap */
    var cells = [['TP', tp, P.a3], ['FP', fp, P.warn], ['FN', fn, P.warn], ['TN', tn, P.a3]];
    var mx = Math.max(tp, fp, fn, tn) || 1;
    grid.innerHTML = cells.map(function (cc) {
      var alpha = 0.12 + 0.55 * (cc[1] / mx);
      return '<div class="cmcell" style="background:' + cc[2] +
        ';opacity:' + (0.25 + 0.75 * alpha) + '"><span>' + cc[0] + '</span><b>' + cc[1] + '</b></div>';
    }).join('');

    function chip(name, v, good, note) {
      var col = good === null ? P.muted : (good ? P.a3 : P.warn);
      return '<div class="metric"><span>' + name + '</span><b style="color:' + col + '">' + fmt(v, 3) + '</b>' +
        (note ? '<i>' + note + '</i>' : '') + '</div>';
    }
    var accMisleading = prev < 0.15 || prev > 0.85;
    out.innerHTML =
      chip('Accuracy', acc, accMisleading ? false : null, accMisleading ? 'misleading at this prevalence' : '') +
      chip('Precision', prec, null, '') +
      chip('Recall', rec, null, '') +
      chip('F1', f1, null, 'ignores TN') +
      chip('Balanced acc', bacc, null, '') +
      chip('MCC', mcc, null, 'best single number') +
      chip('Kappa', kappa, null, '') +
      chip('ROC-AUC', auc, prev < 0.1 ? false : null, prev < 0.1 ? 'optimistic at this prevalence' : '') +
      chip('PR-AUC', ap, null, 'baseline = ' + fmt(prev, 3)) +
      chip('Expected cost', ecost, null, 'lower is better');
  }
  [ssep, sprev, sthr, scost].forEach(function (el) { el.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ---------- W6: clustering / design effect ---------- */
function widgetCluster(root) {
  var sicc = root.querySelector('[data-icc]'), ssz = root.querySelector('[data-sz]'),
      sm = root.querySelector('[data-m]'), cv = root.querySelector('canvas'),
      out = root.querySelector('[data-out]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]'), l3 = root.querySelector('[data-l3]');
  function draw() {
    var P = pal(), icc = parseFloat(sicc.value), sz = parseInt(ssz.value, 10), m = parseInt(sm.value, 10);
    l1.textContent = 'within-session correlation ' + fmt(icc, 2);
    l2.textContent = 'calls per session ' + sz;
    l3.textContent = 'sessions ' + m;
    var rnd = mulberry32(13), clusters = [], flat = [];
    for (var i = 0; i < m; i++) {
      var q = 0.75 + (rnd() - 0.5) * 2 * icc * 0.5;
      q = Math.min(0.99, Math.max(0.05, q));
      var cl = [];
      for (var j = 0; j < sz; j++) { var v = rnd() < q ? 1 : 0; cl.push(v); flat.push(v); }
      clusters.push(cl);
    }
    function bootFlat() {
      var reps = [];
      for (var t = 0; t < 2000; t++) {
        var s = 0; for (var i2 = 0; i2 < flat.length; i2++) s += flat[Math.floor(rnd() * flat.length)];
        reps.push(s / flat.length);
      }
      reps.sort(function (a, b) { return a - b; });
      return [quantile(reps, 0.025), quantile(reps, 0.975)];
    }
    function bootCluster() {
      var reps = [];
      for (var t = 0; t < 2000; t++) {
        var tot = 0, cnt = 0;
        for (var i3 = 0; i3 < m; i3++) {
          var c2 = clusters[Math.floor(rnd() * m)];
          for (var j2 = 0; j2 < c2.length; j2++) { tot += c2[j2]; cnt++; }
        }
        reps.push(tot / cnt);
      }
      reps.sort(function (a, b) { return a - b; });
      return [quantile(reps, 0.025), quantile(reps, 0.975)];
    }
    var a = bootFlat(), b = bootCluster();
    var obs = flat.reduce(function (x, y) { return x + y; }, 0) / flat.length;
    var c = setupCanvas(cv, 130), ctx = c.ctx, pad = { l: 40, r: 14, t: 16, b: 28 };
    axes(ctx, c.w, c.h, pad, 'tool call success rate', '', P);
    var lo = Math.max(0, Math.min(a[0], b[0]) - 0.05), hi = Math.min(1, Math.max(a[1], b[1]) + 0.05);
    function bar(iv, y, color, name) {
      var X = function (v) { return pad.l + (v - lo) / (hi - lo) * (c.w - pad.l - pad.r); };
      ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(X(iv[0]), y); ctx.lineTo(X(iv[1]), y); ctx.stroke();
      ctx.fillStyle = color; ctx.font = '600 11px ui-sans-serif,system-ui,sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(name, pad.l, y - 10);
    }
    bar(a, pad.t + 24, P.warn, 'Naive: resample individual calls');
    bar(b, pad.t + 66, P.a3, 'Cluster: resample sessions');
    var wA = a[1] - a[0], wB = b[1] - b[0];
    out.innerHTML = '<b>Observed rate</b> ' + fmt(obs, 4) +
      '<br>Naive width <b style="color:' + P.warn + '">' + fmt(wA, 4) + '</b>' +
      ' &nbsp; Cluster width <b style="color:' + P.a3 + '">' + fmt(wB, 4) + '</b>' +
      ' &nbsp; <b>understatement ' + fmt(wB / (wA || 1), 2) + 'x</b>' +
      '<br><span style="color:' + P.muted + '">' + flat.length + ' calls, but only ' + m +
      ' independent units. Effective n is closer to ' + m + ' than to ' + flat.length + '.</span>';
  }
  [sicc, ssz, sm].forEach(function (el) { el.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ---------- W7: calibration ---------- */
function widgetCal(root) {
  var st = root.querySelector('[data-temp]'), sn = root.querySelector('[data-noise]'),
      cv = root.querySelector('canvas'), out = root.querySelector('[data-out]'),
      l1 = root.querySelector('[data-l1]'), l2 = root.querySelector('[data-l2]');
  function draw() {
    var P = pal(), sharp = parseFloat(st.value), noise = parseFloat(sn.value);
    l1.textContent = 'confidence sharpening ' + fmt(sharp, 2);
    l2.textContent = 'label noise ' + fmt(noise, 2);
    var rnd = mulberry32(17), y = [], p = [], N = 4000;
    for (var i = 0; i < N; i++) {
      var strength = rnd();
      var truth = rnd() < 0.5 ? 1 : 0;
      var base = truth === 1 ? 0.5 + 0.45 * strength : 0.5 - 0.45 * strength;
      var logit = Math.log(base / (1 - base)) * sharp;
      var prob = 1 / (1 + Math.exp(-logit));
      var obs = rnd() < noise ? 1 - truth : truth;
      y.push(obs); p.push(Math.min(0.999, Math.max(0.001, prob)));
    }
    var bins = 10, bx = [], brier = 0, ece = 0;
    for (var i2 = 0; i2 < N; i2++) brier += (p[i2] - y[i2]) * (p[i2] - y[i2]);
    brier /= N;
    for (var b = 0; b < bins; b++) {
      var lo = b / bins, hi = (b + 1) / bins, idx = [];
      for (var k = 0; k < N; k++) if (p[k] > lo && p[k] <= hi) idx.push(k);
      if (!idx.length) { bx.push(null); continue; }
      var conf = idx.reduce(function (a, i3) { return a + p[i3]; }, 0) / idx.length;
      var acc = idx.reduce(function (a, i3) { return a + y[i3]; }, 0) / idx.length;
      ece += idx.length / N * Math.abs(conf - acc);
      bx.push({ conf: conf, acc: acc, n: idx.length });
    }
    var c = setupCanvas(cv, 210), ctx = c.ctx, pad = { l: 40, r: 14, t: 14, b: 32 };
    axes(ctx, c.w, c.h, pad, 'predicted confidence', 'observed accuracy', P);
    var pw = c.w - pad.l - pad.r, ph = c.h - pad.t - pad.b;
    ctx.setLineDash([4, 3]); ctx.strokeStyle = P.muted; ctx.beginPath();
    ctx.moveTo(pad.l, c.h - pad.b); ctx.lineTo(pad.l + pw, pad.t); ctx.stroke(); ctx.setLineDash([]);
    bx.forEach(function (bb, i4) {
      if (!bb) return;
      var X = pad.l + ((i4 + 0.5) / bins) * pw, Y = c.h - pad.b - bb.acc * ph;
      var Yc = c.h - pad.b - bb.conf * ph;
      ctx.strokeStyle = P.warn; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X, Yc); ctx.lineTo(X, Y); ctx.stroke();
      ctx.fillStyle = P.accent;
      ctx.beginPath(); ctx.arc(X, Y, Math.max(2.5, Math.sqrt(bb.n) / 6), 0, 7); ctx.fill();
    });
    ctx.fillStyle = P.muted; ctx.font = '10px ui-sans-serif,system-ui,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('dashed = perfect calibration; orange stems = gap', pad.l + 6, pad.t + 12);
    out.innerHTML = '<b>Brier</b> ' + fmt(brier, 4) + ' &nbsp; <b>ECE</b> ' +
      '<b style="color:' + (ece > 0.1 ? P.warn : P.a3) + '">' + fmt(ece, 4) + '</b>' +
      '<br><span style="color:' + P.muted + '">Sharpening pushes confidence toward 0 and 1 without changing the ranking. Accuracy and AUC stay put while calibration collapses. If you route, abstain or auto approve on confidence, this is the number that breaks you.</span>';
  }
  [st, sn].forEach(function (el) { el.addEventListener('input', draw); });
  root._draw = draw; draw();
}

/* ---------- W8: decision tree ---------- */
var DTREE = {
  start: { q: 'What are you measuring?', a: [
    ['A pass / fail outcome', 'binary'],
    ['A continuous value (latency, tokens, score)', 'cont'],
    ['An ordinal rating (Likert 1 to 5)', 'ord'],
    ['A count (tool calls per session)', 'count'],
    ['Classifier or judge quality', 'clf']
  ]},
  binary: { q: 'Are the rows independent, or nested inside sessions or users?', a: [
    ['Independent (one row per task)', 'bin_ind'],
    ['Nested (many calls per session)', 'cluster']
  ]},
  bin_ind: { q: 'How many things are you comparing?', a: [
    ['Just describing one model', 'r_wilson'],
    ['Two models on the SAME tasks', 'r_mcnemar'],
    ['Two models on DIFFERENT tasks', 'r_twoprop'],
    ['Three or more on the same tasks', 'r_cochran']
  ]},
  cont: { q: 'How skewed is it? Check mean divided by median.', a: [
    ['Under about 1.2, fairly symmetric', 'cont_sym'],
    ['Above 1.2, right skewed like latency', 'r_quantile']
  ]},
  cont_sym: { q: 'Comparing how many groups?', a: [
    ['Two, same tasks', 'r_pairedboot'],
    ['Two, different tasks', 'r_ttest'],
    ['Three or more, same tasks', 'r_friedman'],
    ['Three or more, independent groups', 'r_anova']
  ]},
  ord: { q: 'What do you need from it?', a: [
    ['One number a product team can act on', 'r_top2'],
    ['A comparison between two versions', 'r_mwu']
  ]},
  count: { q: 'Check variance divided by mean first.', a: [
    ['Near 1', 'r_poisson'],
    ['Well above 1, the usual case', 'r_negbin']
  ]},
  clf: { q: 'What is the situation?', a: [
    ['Rare positive class', 'r_pr'],
    ['One number to compare models', 'r_mcc'],
    ['Judge versus human agreement', 'r_kappa'],
    ['Confidence is used downstream', 'r_cal'],
    ['The system can abstain', 'r_selective'],
    ['You know the relative error costs', 'r_cost']
  ]},
  cluster: { q: '', a: [] },

  r_wilson: { r: 'Wilson interval', why: 'Holds coverage where the normal approximation fails, near 0 and 1 and at small n.', con: 'Still a single snapshot. Report n and the raw counts beside it.' },
  r_mcnemar: { r: 'Exact McNemar', why: 'Uses the pairing, which is where nearly all your power lives on a shared task set.', con: 'Discards concordant pairs, so it says nothing about overall level. Report both pass rates too.' },
  r_twoprop: { r: 'Two proportion test, or unpaired bootstrap', why: 'No pairing available, so treat as independent samples.', con: 'Far less power than a paired design. Prefer sharing the task set if you possibly can.' },
  r_cochran: { r: "Cochran's Q, then pairwise McNemar with Benjamini Hochberg", why: 'Q is the paired multi group extension of McNemar.', con: 'Q only says "some model differs". Reporting the winner without the corrected pairwise step is the multiple comparisons mistake.' },
  r_quantile: { r: 'Report p50, p95, p99 with bootstrap CIs', why: 'The mean is dominated by the tail and describes nobody.', con: 'p99 on under about 1000 points rests on a handful of observations, and the bootstrap upper bound is censored at your observed maximum.' },
  r_pairedboot: { r: 'Paired bootstrap on the per task difference', why: 'Distribution free and keeps the pairing.', con: 'Needs n of at least about 20 to be meaningful. Under that, use an exact method.' },
  r_ttest: { r: "Welch's t test", why: 'Does not assume equal variances, which is usually the safer default.', con: 'Assumes roughly normal group means. Check skew first; if skewed, bootstrap instead.' },
  r_friedman: { r: 'Friedman test on within task ranks', why: 'Ordinal safe and keeps the pairing across three or more models.', con: 'Ranks discard magnitude. A tiny consistent win and a huge one look identical.' },
  r_anova: { r: 'One way ANOVA, and always report eta squared', why: 'Correct for independent continuous groups.', con: 'Throws away pairing if the tasks are shared. A large F on a large sample can still be an effect nobody notices.' },
  r_top2: { r: 'Top two box proportion, with a Wilson interval', why: 'Actionable and avoids pretending an ordinal scale is interval.', con: 'Discards information about movement within the bottom of the scale.' },
  r_mwu: { r: 'Mann Whitney U, report the common language effect size', why: 'Rank based, no interval assumption.', con: 'Not a test of medians unless the shapes match. Report the effect size, not just the p value.' },
  r_poisson: { r: 'Poisson intervals are acceptable', why: 'Variance near mean means the assumption holds.', con: 'Recheck when traffic mix changes. Overdispersion appears the moment task difficulty varies.' },
  r_negbin: { r: 'Negative binomial, or just quantiles with a bootstrap', why: 'A mixture of Poissons is a negative binomial, which is what varied task difficulty produces.', con: 'Harder to explain. If you only need an interval, the bootstrap on quantiles is simpler and defensible.' },
  r_pr: { r: 'Precision, recall and PR-AUC, always with prevalence', why: 'PR-AUC is honest under imbalance where ROC-AUC is not.', con: 'PR-AUC baseline is the prevalence, not 0.5, so it is meaningless without it. Unstable under about 30 positives.' },
  r_mcc: { r: 'Matthews correlation coefficient', why: 'Uses all four confusion cells and is symmetric under class swap.', con: 'Harder to explain to non specialists. Pair it with the confusion matrix.' },
  r_kappa: { r: "Cohen's kappa, plus prevalence and the pass rate gap", why: 'Discounts agreement that happens by luck on a skewed label set.', con: 'The kappa paradox: high agreement with extreme prevalence gives a low kappa. Not comparable across differently distributed sets.' },
  r_cal: { r: 'Brier score, ECE and a reliability diagram', why: 'Ranking quality and confidence quality are different properties.', con: 'ECE is bin count sensitive and can be gamed. It is not a proper scoring rule, so pair it with Brier.' },
  r_selective: { r: 'Coverage risk curve', why: 'Turns abstention into a design choice you can price.', con: 'Only meaningful if confidence tracks correctness. A flat curve means abstention will not help, which is itself the finding.' },
  r_cost: { r: 'Expected cost at a swept threshold', why: 'The only metric that is about your actual problem rather than a proxy.', con: 'Needs cost estimates people resist giving, and a threshold tuned on one traffic mix drifts when the mix moves.' },
  cluster_r: { r: 'Cluster bootstrap, resampling sessions', why: 'Rows inside a session are not independent.', con: 'Needs enough clusters, roughly 30 or more. With 10 sessions the cluster bootstrap is itself unstable.' }
};
DTREE.cluster = DTREE.cluster_r;

function widgetTree(root) {
  var box = root.querySelector('[data-tree]');
  var path = ['start'];
  function render() {
    var P = pal(), node = DTREE[path[path.length - 1]];
    var html = '<div class="crumbs">';
    html += path.map(function (k, i) {
      return '<button class="crumb" data-i="' + i + '">' + (i === 0 ? 'start' : (DTREE[k].r ? 'answer' : 'step ' + i)) + '</button>';
    }).join('<span class="sep">&rsaquo;</span>');
    html += '</div>';
    if (node.r) {
      html += '<div class="answer"><div class="alabel">Use</div><div class="atitle">' + node.r + '</div>' +
        '<div class="arow"><b>Why</b>' + node.why + '</div>' +
        '<div class="arow con"><b>Con</b>' + node.con + '</div></div>';
      html += '<button class="restart">Start over</button>';
    } else {
      html += '<div class="q">' + node.q + '</div><div class="opts">' +
        node.a.map(function (o, i) { return '<button class="opt" data-go="' + o[1] + '">' + o[0] + '</button>'; }).join('') +
        '</div>';
    }
    box.innerHTML = html;
    box.querySelectorAll('.opt').forEach(function (b) {
      b.addEventListener('click', function () { path.push(b.getAttribute('data-go')); render(); });
    });
    box.querySelectorAll('.crumb').forEach(function (b) {
      b.addEventListener('click', function () { path = path.slice(0, parseInt(b.getAttribute('data-i'), 10) + 1); render(); });
    });
    var rs = box.querySelector('.restart');
    if (rs) rs.addEventListener('click', function () { path = ['start']; render(); });
  }
  root._draw = render; render();
}

/* ---------- boot ---------- */
var WIDGETS = [];
function initWidgets() {
  var map = {
    dist: widgetDist, ci: widgetCI, power: widgetPower, boot: widgetBoot,
    clf: widgetClf, cluster: widgetCluster, cal: widgetCal, tree: widgetTree
  };
  if (typeof EXTRA_WIDGETS === 'object') {
    Object.keys(EXTRA_WIDGETS).forEach(function (k) { map[k] = EXTRA_WIDGETS[k]; });
  }
  Object.keys(map).forEach(function (id) {
    var el = document.getElementById('w-' + id);
    if (el) { try { map[id](el); WIDGETS.push(el); } catch (e) { console.error(id, e); } }
  });
}
function redrawAll() { WIDGETS.forEach(function (el) { if (el._draw) try { el._draw(); } catch (e) {} }); }
window.addEventListener('resize', function () { clearTimeout(window.__rt); window.__rt = setTimeout(redrawAll, 150); });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initWidgets);
else initWidgets();

window.__legacyRedraw=(window.__legacyRedraw||[]).concat([redrawAll]);
