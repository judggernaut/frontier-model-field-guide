/* Chapter 73: same mean, different story (ordinal ratings) and a test chooser by data type. */
G.widget('w-ms-same', function (root) {
  var sM = G.$(root, '#ms-mu'), sA = G.$(root, '#ms-sa'), sW = G.$(root, '#ms-w'), sN = G.$(root, '#ms-n');
  var oM = G.$(root, '#ms-mu-o'), oA = G.$(root, '#ms-sa-o'), oW = G.$(root, '#ms-w-o'), oN = G.$(root, '#ms-n-o');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]'), k = function (n) { return G.$(root, '[data-k2=' + n + ']'); };
  var CUT = [1.5, 2.5, 3.5, 4.5];
  // ordered-probit: a latent normal score cut into 5 categories
  function cats(loc, sd) {
    var p = [], prev = 0;
    for (var i = 0; i < 4; i++) { var c = G.ncdf((CUT[i] - loc) / sd); p.push(c - prev); prev = c; }
    p.push(1 - prev); return p;
  }
  function mix(w, loc) {
    var a = cats(1.0, 0.6), b = cats(loc, 0.8);
    return a.map(function (v, i) { return w * v + (1 - w) * b[i]; });
  }
  function meanP(p) { var s = 0; for (var i = 0; i < 5; i++) s += (i + 1) * p[i]; return s; }
  function solve(f, target) {   // find loc with meanP(f(loc)) = target by bisection (mean rises with loc)
    var lo = -4, hi = 10;
    for (var it = 0; it < 60; it++) { var m = (lo + hi) / 2; if (meanP(f(m)) < target) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function counts(p, n) {       // expected counts, rounded so they sum to n
    var raw = p.map(function (v) { return v * n; }), c = raw.map(Math.floor), left = n - G.sum(c);
    raw.map(function (v, i) { return [v - c[i], i]; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, left).forEach(function (x) { c[x[1]]++; });
    return c;
  }
  function stats(c) {
    var n = G.sum(c), m = 0, v = 0, i;
    for (i = 0; i < 5; i++) m += (i + 1) * c[i]; m /= n;
    for (i = 0; i < 5; i++) v += c[i] * (i + 1 - m) * (i + 1 - m); v /= (n - 1);
    var half = n / 2, cum = 0, med = 5;
    for (i = 0; i < 5; i++) { cum += c[i]; if (cum >= half) { med = i + 1; break; } }
    return { n: n, m: m, v: v, med: med };
  }
  function draw() {
    var P = G.pal(), mu = +sM.value, sa = +sA.value, w = +sW.value, n = +sN.value;
    oM.textContent = G.fmt(mu, 2); oA.textContent = G.fmt(sa, 2); oW.textContent = G.pct(w, 0); oN.textContent = n;
    var pa = cats(solve(function (l) { return cats(l, sa); }, mu), sa);
    var feasible = meanP(mix(w, 10)) >= mu - 0.005;
    var pb = mix(w, solve(function (l) { return mix(w, l); }, mu));
    var ca = counts(pa, n), cb = counts(pb, n), A = stats(ca), B = stats(cb);
    // Welch t (normal approximation for the p value)
    var se = Math.sqrt(A.v / A.n + B.v / B.n), tz = (B.m - A.m) / se, tp = 2 * (1 - G.ncdf(Math.abs(tz)));
    // Mann-Whitney U for B with mid-ranks and tie correction
    var N = A.n + B.n, below = 0, U = 0, ties = 0;
    for (var i = 0; i < 5; i++) {
      U += cb[i] * (below + 0.5 * ca[i]); below += ca[i];
      var t = ca[i] + cb[i]; ties += t * t * t - t;
    }
    var th = U / (A.n * B.n), vU = A.n * B.n / 12 * ((N + 1) - ties / (N * (N - 1)));
    var uz = (U - A.n * B.n / 2) / Math.sqrt(vU), up = 2 * (1 - G.ncdf(Math.abs(uz)));
    // chart: grouped bars of shares per category
    var c = G.canvas(cv, 250), ctx = c.ctx, pad = { l: 44, r: 12, t: c.w < 520 ? 44 : 26, b: 64 };
    var ymax = Math.max(0.5, Math.ceil(Math.max.apply(null, pa.concat(pb)) * 10 + 0.5) / 10);
    var yt = []; for (var y = 0; y <= ymax + 1e-9; y += 0.1) yt.push(Math.round(y * 10) / 10);
    var ax = G.axes(ctx, c.w, c.h, pad, { x: [0.5, 5.5], y: [0, ymax], xt: [1, 2, 3, 4, 5], yt: yt, yf: function (v) { return Math.round(v * 100) + '%'; }, yl: 'share of ratings' });
    var bw = Math.min(34, (ax.X(2) - ax.X(1)) * 0.36);
    for (i = 0; i < 5; i++) {
      var x = ax.X(i + 1);
      ctx.fillStyle = P.accent; ctx.fillRect(x - bw - 1, ax.Y(ca[i] / A.n), bw, ax.Y(0) - ax.Y(ca[i] / A.n));
      ctx.fillStyle = P.eli5; ctx.fillRect(x + 1, ax.Y(cb[i] / B.n), bw, ax.Y(0) - ax.Y(cb[i] / B.n));
    }
    G.dot(ctx, pad.l + 10, 12, 5, P.accent); G.text(ctx, 'Model A', pad.l + 20, 12, P.fg, 'left', 12);
    G.dot(ctx, pad.l + 100, 12, 5, P.eli5); G.text(ctx, 'Model B', pad.l + 110, 12, P.fg, 'left', 12);
    // summary strips: mean (diamond) and median (bar) on the 1-5 scale
    function strip(yy, S, col, name) {
      G.line(ctx, [[ax.X(1), yy], [ax.X(5), yy]], P.line, 1);
      G.text(ctx, name, pad.l - 6, yy, col, 'right', 11.5);
      ctx.fillStyle = col; ctx.fillRect(ax.X(S.med) - 1.5, yy - 7, 3, 14);
      var mx = ax.X(S.m); ctx.beginPath(); ctx.moveTo(mx, yy - 6); ctx.lineTo(mx + 6, yy); ctx.lineTo(mx, yy + 6); ctx.lineTo(mx - 6, yy); ctx.closePath(); ctx.fill();
    }
    strip(c.h - 30, A, P.accent, 'A'); strip(c.h - 12, B, P.eli5, 'B');
    if (c.w < 520) G.text(ctx, '◆ mean   | median (strips below)', pad.l + 4, 30, P.muted, 'left', 11); else G.text(ctx, '◆ mean   | median (strips below)', c.w - pad.r, 12, P.muted, 'right', 11);
    k('mean').textContent = G.fmt(A.m, 2) + ' / ' + G.fmt(B.m, 2);
    k('med').textContent = A.med + ' / ' + B.med;
    k('tp').textContent = tp < 0.001 ? '<0.001' : G.fmt(tp, 3); k('tp').style.color = tp < 0.05 ? 'var(--fp)' : 'var(--fg)';
    k('up').textContent = up < 0.001 ? '<0.001' : G.fmt(up, 3); k('up').style.color = up < 0.05 ? 'var(--fp)' : 'var(--fg)';
    k('th').textContent = G.pct(th, 0);
    k('one').textContent = G.pct(ca[0] / A.n, 0) + ' / ' + G.pct(cb[0] / B.n, 0);
    var msg = '';
    if (!feasible) msg += '<b>Model B cannot reach a mean of ' + G.fmt(mu, 2) + ' with a ' + G.pct(w, 0) + ' unhappy minority</b>, so the means no longer match; lower the minority or the mean. ';
    msg += 'Both models average about <b>' + G.fmt(A.m, 2) + '</b>, so the t-test sees nothing (p ' + (tp < 0.001 ? '&lt; 0.001' : '= ' + G.fmt(tp, 2)) + '). ';
    if (w < 0.02) msg += 'With no unhappy minority the two distributions differ only in spread, and the rank test also finds little: P(B rated higher) is ' + G.pct(th, 0) + '.';
    else {
      msg += 'The rank test asks a different question, whether a random B rating tends to beat a random A rating, and answers ' + G.pct(th, 0) + ' (p ' + (up < 0.001 ? '&lt; 0.001' : '= ' + G.fmt(up, 3)) + '). ';
      msg += 'Meanwhile B gives a 1 to <b>' + G.pct(cb[0] / B.n, 0) + '</b> of users against ' + G.pct(ca[0] / A.n, 0) + ' for A. ';
      msg += 'Neither test is wrong. Which model is better depends on whether the decision cares about the typical user, the average, or the users B fails, and only the full distribution shows all three.';
    }
    out.innerHTML = msg;
  }
  G.on([sM, sA, sW, sN], 'input', draw);
  return draw;
});

G.widget('w-ms-chooser', function (root) {
  var st = { type: 'bin', groups: '2', paired: 'no' }, rec = G.$(root, '[data-rec]');
  // For each type: test for [groups][paired], plus summary, assumption, drawback, and a link.
  var D = {
    bin: { t: { '2no': 'Two-proportion z test, or Fisher’s exact test when any cell is small', '2yes': 'McNemar’s test on the discordant pairs (exact version for few discordant pairs)', '3no': 'Chi-square test of independence on the groups × outcome table', '3yes': 'Cochran’s Q, then pairwise McNemar with a multiplicity correction' },
      s: 'Each group’s rate with its count and a Wilson interval; the difference with a Newcombe or bootstrap interval.',
      a: 'Items are independent. Tasks nested in conversations or repeated seeds are not; resample the clusters.',
      d: 'Chi-square approximations fail when expected counts fall below about 5. An unpaired test on paired runs throws away most of the power.', l: '<a href="#evalstats">Statistics for eval sets</a>' },
    ord: { t: { '2no': 'Mann–Whitney U, with P(B &gt; A) as the effect size', '2yes': 'Wilcoxon signed-rank, or the sign test if you treat differences as purely ordinal', '3no': 'Kruskal–Wallis, then pairwise Mann–Whitney with a correction', '3yes': 'Friedman test' },
      s: 'The full distribution, the median, and the share at the top and bottom of the scale. Ordinal (cumulative logit) regression if you need covariates.',
      a: 'Order is meaningful and gaps are not assumed equal. Mann–Whitney compares medians only if the two shapes match.',
      d: 'Five-point scales have heavy ties, so use the tie-corrected variance. Rank tests give a p value and a probability of superiority, not a difference in points.', l: '<a href="#lookup">From shape to method</a>' },
    norm: { t: { '2no': 'Welch’s t-test (does not assume equal variances)', '2yes': 'Paired t-test on the per-item differences', '3no': 'Welch’s one-way ANOVA, then pairwise comparisons with a correction', '3yes': 'Repeated-measures ANOVA or a mixed model with a random effect per item' },
      s: 'Mean difference with a confidence interval and a standardised effect size.',
      a: 'Interval or ratio data; the sampling distribution of the mean is close to normal, which holds for moderate n unless tails are heavy.',
      d: 'A few outliers move the mean and inflate the variance. Check the shape first; if it leans hard, use the heavy-tailed row instead.', l: '<a href="#bigideas">Sampling and error bars</a>' },
    tail: { t: { '2no': 't-test on log values (a ratio of geometric means), or a bootstrap of the percentile you care about', '2yes': 'Paired t-test on log ratios, or a paired bootstrap', '3no': 'Kruskal–Wallis for "which tends to be larger", or a bootstrap per group', '3yes': 'Friedman on per-item values, or a mixed model on logs' },
      s: 'Median and high percentiles (p90, p99) with bootstrap intervals; the geometric mean if you compare on a log scale.',
      a: 'Values are positive (ratio scale). On logs, effects act multiplicatively.',
      d: 'Logging changes the question from the mean to the geometric mean. If the business pays for the arithmetic total (cost), the mean still matters, and it needs many samples.', l: '<a href="#tails">Long tails and outliers</a>' },
    count: { t: { '2no': 'Negative binomial regression with a group term (Poisson only if variance ≈ mean)', '2yes': 'Negative binomial or Poisson mixed model with a random effect per unit', '3no': 'Negative binomial regression with a group factor; likelihood-ratio test', '3yes': 'Mixed-effects negative binomial with a random effect per unit' },
      s: 'Rate per unit of exposure (per session, per day) and the rate ratio between groups with its interval.',
      a: 'Exposure is accounted for (use an offset for session length or time). Overdispersion is modelled.',
      d: 'Poisson error bars on overdispersed counts can be several times too narrow. Many zeros may need a hurdle or zero-inflated model.', l: '<a href="#zoo">The distribution zoo</a>' },
    surv: { t: { '2no': 'Log-rank test, with Kaplan–Meier curves for each group', '2yes': 'Stratified log-rank, or Cox regression stratified by the pairing unit', '3no': 'k-sample log-rank test; Cox regression with a group factor', '3yes': 'Cox regression with strata or a frailty term per unit' },
      s: 'Kaplan–Meier curves, the median time with its interval, and the censoring rate in each group. A hazard ratio from Cox regression.',
      a: 'Censoring is unrelated to the outcome. For Cox, hazards are proportional over time.',
      d: 'The log-rank test loses power when curves cross. If the median is not reached, report "more than T" instead of an invented number.', l: '<a href="#reading">Reading a shape: censoring</a>' },
    ratio: { t: { '2no': 'z test on the ratio of means, with the delta-method variance computed per randomization unit', '2yes': 'Paired comparison of per-unit ratios, or a paired bootstrap over units', '3no': 'Pairwise delta-method z tests with a multiplicity correction', '3yes': 'Bootstrap over units, resampling each unit’s data in every group together' },
      s: 'Ratio of totals in each group, its relative change, and a delta-method or unit-level bootstrap interval.',
      a: 'The variance is computed at the randomization unit (usually the user), not per event.',
      d: 'Treating events as independent gives error bars that are too narrow. A ratio of means is not the mean of per-user ratios; decide which one the decision needs.', l: '<a href="#intervals">Intervals and clustering</a>' },
    judge: { t: { '2no': 'Mann–Whitney on the scores; better, redesign so both models answer the same prompts', '2yes': 'Wilcoxon signed-rank on per-prompt score differences, or a sign test on pairwise verdicts', '3no': 'Kruskal–Wallis; redesign as paired if you can', '3yes': 'Friedman test on per-prompt scores, or Bradley–Terry on pairwise verdicts' },
      s: 'Score distribution, win/tie/loss counts on paired prompts, and the judge’s agreement with humans (kappa) and with itself.',
      a: 'The judge is reliable and unbiased with respect to the change being tested. Order of presentation is randomized.',
      d: 'If the treatment changes style (length, formatting), judge bias becomes treatment bias, and no test can see it. Averaging a few judge samples per item cuts noise.', l: '<a href="#judges">LLM as judge</a>' }
  };
  function draw() {
    var d = D[st.type], key = st.groups + st.paired;
    rec.innerHTML = '<div><span class="k">Test</span><span><b>' + d.t[key] + '</b></span></div>' +
      '<div><span class="k">Report</span><span>' + d.s + '</span></div>' +
      '<div><span class="k">Assumes</span><span>' + d.a + '</span></div>' +
      '<div><span class="k">Drawback</span><span>' + d.d + '</span></div>' +
      '<div><span class="k">More</span><span>' + d.l + '</span></div>';
  }
  G.$$(root, '[data-k]').forEach(function (g) {
    var key = g.dataset.k, bs = G.$$(g, 'button');
    bs.forEach(function (b) {
      G.on(b, 'click', function () { st[key] = b.dataset.v; bs.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); draw(); });
    });
  });
  return draw;
});
