G.widget('w-ld-seeds', function (root) {
  var sd = G.$(root, '#ld-sd'), dd = G.$(root, '#ld-d'), cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var sdo = G.$(root, '#ld-sd-o'), ddo = G.$(root, '#ld-d-o');
  var wrong = G.$(root, '[data-wrong]'), n80el = G.$(root, '[data-n80]'), ratio = G.$(root, '[data-ratio]');
  function power(n, d, s) { return G.ncdf(d / (s * Math.sqrt(2 / n)) - 1.96); }
  function draw() {
    var P = G.pal(), s = +sd.value, d = +dd.value;
    sdo.textContent = G.fmt(s, 1); ddo.textContent = G.fmt(d, 1);
    var n80 = Math.ceil(2 * Math.pow((1.96 + 0.8416) * s / d, 2));
    var nmax = 20;
    var c = G.canvas(cv, 220), ctx = c.ctx;
    var ax = G.axes(ctx, c.w, c.h, { l: 44, r: 14, t: 12, b: 36 }, { x: [1, nmax], y: [0, 1], xt: [1, 5, 10, 15, 20], yt: [0, .5, .8, 1], yf: function (v) { return Math.round(v * 100) + '%'; }, xl: 'seeds per arm', yl: 'power' });
    G.line(ctx, [[ax.X(1), ax.Y(.8)], [ax.X(nmax), ax.Y(.8)]], P.faint, 1, [4, 4]);
    var pts = []; for (var n = 1; n <= nmax; n += 0.25) pts.push([ax.X(n), ax.Y(power(n, d, s))]);
    G.line(ctx, pts, P.accent, 2.5);
    for (var k = 1; k <= nmax; k++) G.dot(ctx, ax.X(k), ax.Y(power(k, d, s)), 3, P.accent);
    if (n80 <= nmax) { G.dot(ctx, ax.X(n80), ax.Y(power(n80, d, s)), 6, P.good, P.surface); G.text(ctx, n80 + ' seeds', ax.X(n80) + 8, ax.Y(power(n80, d, s)) + 14, P.good); }
    var pw = G.ncdf(-d / (s * Math.SQRT2));
    wrong.textContent = G.pct(pw); n80el.textContent = n80 > 999 ? '>999' : n80; ratio.textContent = G.fmt(d / s, 2);
    out.textContent = 'With one seed per arm, a true gain of ' + G.fmt(d, 1) + ' points shows up with the wrong sign ' + G.pct(pw) +
      ' of the time. To detect it 80% of the time you need about ' + (n80 > 999 ? 'more than 999' : n80) + ' seeds per arm' +
      (n80 > 10 ? ', which is usually too expensive: shrink seed noise (bigger eval sets, paired items) or accept that this gain is below what you can resolve.' : '.');
  }
  G.on([sd, dd], 'input', draw);
  return draw;
});

/* Review a result: the reader ticks which checklist questions a sample slide answers. The meter is a
   rough heuristic (weighted share of applicable questions answered), not a statistic. Slides are invented. */
G.widget('w-ld-review', function (root) {
  var boxP = G.$(root, '[data-presets]'), boxS = G.$(root, '[data-slide]'), boxL = G.$(root, '[data-list]'), svg = G.$(root, '[data-meter]');
  var bKey = G.$(root, '[data-key]'), bClear = G.$(root, '[data-clear]'), out = G.$(root, '[data-out]');
  var k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  // The chapter's checklist rows and links. Weight 3: most often overturns a result; 2: often; 1: sometimes.
  var Q = [
    { q: 'What is the interval on that number, and what is n?', w: 3, L: [['#evalstats', 'Eval statistics']] },
    { q: 'Was the comparison paired on the same items?', w: 1, L: [['#evalstats', 'Eval statistics']] },
    { q: 'How many metrics or benchmarks were looked at?', w: 2, L: [['#evalstats', 'Multiple comparisons']] },
    { q: 'Are items clustered (multi-turn, agent traces, per-repo tasks)?', w: 1, L: [['#intervals', 'Clustering']] },
    { q: 'What is the seed variance, and how many seeds?', w: 3, L: [['#leading', 'Seeds (this chapter)']] },
    { q: 'Is the comparison compute-matched and baseline-tuned?', w: 2, L: [['#leading', 'This chapter'], ['#scaling', 'scaling']] },
    { q: 'Who or what scored it, and was the scorer validated?', w: 2, L: [['#judges', 'LLM as judge']] },
    { q: 'Could the eval items be in the training data?', w: 2, L: [['#contamination', 'Contamination']] },
    { q: 'Does the offline gain predict an online gain?', w: 1, L: [['#gap', 'Offline to online gap']] },
    { q: 'What got worse?', w: 2, L: [['#sft', 'SFT'], ['#triage', 'triage']] },
    { q: 'Was decoding held fixed?', w: 1, L: [['#inference', 'Inference']] },
    { q: 'Is the reward or verifier being exploited?', w: 2, L: [['#reward-models', 'Reward models'], ['#grpo', 'GRPO']] }
  ];
  // key: [status, note] per question; status y = answered, n = not answered, x = not applicable.
  var SLIDES = [
    { btn: 'A: careful ablation', title: 'New code-data mix, 7B model', metric: 'Internal coding suite, pass@1', kind: 'delta', base: 41.2, now: 44.3, ci: [1.6, 4.6],
      bullets: ['Paired on the same 1,640 problems, each from a different repository, graded by its unit tests.', '3 seeds per arm; seed-to-seed std 0.6 points.',
        'Same tokens and FLOPs; learning rate re-tuned for both arms (8 trials each).', 'Pre-registered: coding is the primary metric; math and long-context retrieval are guardrails. No other evals were run.',
        '13-gram overlap check flagged 0.4% of problems; removing them leaves the gain unchanged.', 'Regressions: math −0.4 (within seed noise); long-context retrieval −1.1 (CI −2.3 to +0.1), being watched.',
        'Greedy decoding and the same prompt template in both arms.', 'Online A/B test not run yet.'],
      key: [['y', 'n = 1,640 with a 95% interval.'], ['y', 'Same problems in both arms.'], ['y', 'Three pre-registered evals, all reported.'], ['y', 'One problem per repository, so items are independent.'],
        ['y', '3 seeds per arm, std 0.6.'], ['y', 'Same tokens and FLOPs, equal tuning trials.'], ['y', 'Unit tests: an executable, validated scorer.'], ['y', 'Overlap check run, gain unchanged.'],
        ['n', 'No online test yet, so the offline gain is still a forecast.'], ['y', 'Two regressions reported with intervals.'], ['y', 'Greedy, same template.'], ['x', 'No RL or learned reward in this change.']] },
    { btn: 'B: typical draft', title: 'New chat SFT data mix', metric: 'LLM-judge win rate against the baseline', kind: 'win', now: 61, ci: [58, 64],
      bullets: ['800 prompts from the internal helpfulness set; both models answer every prompt.', 'Judge: a frontier LLM with our standard rubric.',
        'Same base model and same number of training tokens.', 'Also up on 5 of the 12 academic benchmarks we track (table in appendix).',
        'One training run per arm.', 'Greedy decoding, same chat template.'],
      key: [['y', 'n = 800 with a 95% interval.'], ['y', 'Both models answer the same prompts, so the comparison is paired.'], ['y', '12 benchmarks tracked. With no intervals, "up on 5 of 12" is close to what noise alone would give.'],
        ['n', 'Not stated whether prompts are multi-turn or grouped by conversation or user.'], ['n', 'One run per arm and no seed variance.'], ['n', 'Tokens matched, but nothing on how much tuning each arm got.'],
        ['n', 'Judge named, but no agreement with human raters; judges favour length and style.'], ['n', 'No contamination check.'], ['n', 'No online evidence.'],
        ['n', 'Only the benchmarks that went up are mentioned. What happened on the other 7?'], ['y', 'Greedy, same template.'], ['x', 'SFT only: no reward model or verifier.']] },
    { btn: 'C: too good to be true', title: 'RL with a new math verifier', metric: 'Public math benchmark, 500 problems, accuracy', kind: 'delta', base: 48, now: 63, ci: null,
      bullets: ['Best of 4 RL runs, compared with the production checkpoint.', 'Scored by exact match on the final numeric answer.',
        'Benchmark released in 2023; pretraining data runs to mid-2024.', 'Training reward rose steadily until the last step.', 'Other evals: coming next sprint.'],
      key: [['n', 'n = 500, but no interval. A single score at this n is uncertain by about ±4 points.'], ['n', 'No paired test reported.'], ['n', 'One benchmark shown. How many were checked before this one was picked?'],
        ['x', 'Independent single-answer problems; clustering is unlikely to matter.'], ['n', '"Best of 4" is a selected run. Report the mean and spread of all 4.'],
        ['n', 'Compared with production, which had a different budget: not compute-matched.'], ['y', 'Exact match on a numeric answer is a sound scorer for this format.'],
        ['n', 'Public 2023 benchmark, pretraining to mid-2024: contamination is likely and unchecked.'], ['n', 'No online evidence.'], ['n', 'Other evals "next sprint": regressions unknown.'],
        ['n', 'Decoding settings not stated.'], ['n', 'Reward rising to the end with no held-out check: verifier hacking is possible.']] }
  ];
  var cur = 1, showKey = false, ticks = SLIDES.map(function () { return Q.map(function () { return false; }); });

  var pbtns = SLIDES.map(function (s, i) {
    var b = document.createElement('button'); b.className = 'b'; b.type = 'button'; b.textContent = 'Slide ' + s.btn;
    b.addEventListener('click', function () { cur = i; showKey = false; build(); draw(); }); boxP.appendChild(b); return b;
  });
  var items = [];
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function chart(s) {
    // 0–80 scale for every slide, so gains are drawn honestly against the full height.
    var H = 150, top = 14, bot = 122, Yv = function (v) { return bot - (bot - top) * v / 80; }, g = '';
    g += '<line x1="34" y1="' + bot + '" x2="214" y2="' + bot + '" stroke="var(--line-strong)"/>';
    [0, 40, 80].forEach(function (t) { g += '<text x="28" y="' + (Yv(t) + 4) + '" font-size="11" text-anchor="end" fill="var(--faint)">' + G.fmt(t, 0) + '%</text>'; });
    if (s.kind === 'win') {
      g += '<line x1="40" y1="' + Yv(50) + '" x2="214" y2="' + Yv(50) + '" stroke="var(--muted)" stroke-dasharray="4 4"/><text x="38" y="' + (Yv(50) - 6) + '" font-size="11" fill="var(--muted)">tie = 50%</text>';
      g += '<rect x="100" y="' + Yv(s.now) + '" width="46" height="' + (bot - Yv(s.now)) + '" rx="3" fill="var(--accent)"/>';
      g += '<line x1="123" y1="' + Yv(s.ci[0]) + '" x2="123" y2="' + Yv(s.ci[1]) + '" stroke="var(--fg)" stroke-width="2"/>';
      g += '<text x="154" y="' + (Yv(s.now) + 4) + '" font-size="12" fill="var(--fg)">' + G.fmt(s.now, 0) + '%</text>';
      g += '<text x="123" y="' + (bot + 18) + '" font-size="12" text-anchor="middle" fill="var(--muted)">new vs old</text>';
    } else {
      [[s.base, 'before', 'var(--faint)', 60], [s.now, 'after', 'var(--accent)', 130]].forEach(function (b) {
        g += '<rect x="' + b[3] + '" y="' + Yv(b[0]) + '" width="46" height="' + (bot - Yv(b[0])) + '" rx="3" fill="' + b[2] + '"/>';
        g += '<text x="' + (b[3] + 23) + '" y="' + (Yv(b[0]) - 6) + '" font-size="12" text-anchor="middle" fill="var(--fg)">' + G.fmt(b[0], 1) + '%</text>';
        g += '<text x="' + (b[3] + 23) + '" y="' + (bot + 18) + '" font-size="12" text-anchor="middle" fill="var(--muted)">' + b[1] + '</text>';
      });
      if (s.ci) g += '<line x1="153" y1="' + Yv(s.base + s.ci[0]) + '" x2="153" y2="' + Yv(s.base + s.ci[1]) + '" stroke="var(--fg)" stroke-width="2"/>';
    }
    return '<svg viewBox="0 0 220 ' + H + '" role="img" aria-label="Bar chart of the claimed result" style="flex:0 1 220px;width:220px;max-width:100%;height:auto">' + g + '</svg>';
  }
  function headline(s) {
    if (s.kind === 'win') return G.fmt(s.now, 0) + '% win rate (95% CI ' + G.fmt(s.ci[0], 0) + '% to ' + G.fmt(s.ci[1], 0) + '%)';
    var d = s.now - s.base;
    return '+' + G.fmt(d, 1) + ' points' + (s.ci ? ' (95% CI +' + G.fmt(s.ci[0], 1) + ' to +' + G.fmt(s.ci[1], 1) + ')' : '!');
  }
  function build() {
    var s = SLIDES[cur];
    pbtns.forEach(function (b, i) { b.setAttribute('aria-pressed', i === cur ? 'true' : 'false'); });
    boxS.innerHTML = '<div style="border:1px solid var(--line-strong);border-radius:10px;background:var(--surface);padding:14px 16px;margin:0 0 14px;display:flex;flex-wrap:wrap;gap:10px 20px;align-items:center">' +
      '<div style="flex:1 1 300px;min-width:0"><div style="font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--faint)">Results slide (invented example)</div>' +
      '<div style="font-size:16px;font-weight:600;margin:2px 0">' + esc(s.title) + '</div>' +
      '<div style="font-size:22px;font-weight:600;color:var(--accent);line-height:1.3">' + headline(s) + '</div>' +
      '<div style="font-size:13px;color:var(--muted);margin-bottom:6px">' + esc(s.metric) + '</div>' +
      '<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.55">' + s.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>' +
      chart(s) + '</div>';
    boxL.innerHTML = ''; items = [];
    Q.forEach(function (q, i) {
      var na = s.key[i][0] === 'x', d = document.createElement('div');
      d.innerHTML = '<label style="display:flex;gap:8px;align-items:flex-start;font-size:14px;line-height:1.45;cursor:' + (na ? 'default' : 'pointer') + ';color:' + (na ? 'var(--faint)' : 'var(--fg)') + '">' +
        '<input type="checkbox" style="margin-top:3px;flex:none"' + (na ? ' disabled' : '') + (ticks[cur][i] ? ' checked' : '') + '><span>' + esc(q.q) + (na ? ' <i>(not applicable here)</i>' : '') + '</span></label>' +
        '<div data-note style="font-size:12.5px;line-height:1.45;margin:2px 0 0 24px"></div>';
      var cb = d.querySelector('input');
      cb.addEventListener('change', function () { ticks[cur][i] = cb.checked; draw(); });
      boxL.appendChild(d); items.push({ cb: cb, note: d.querySelector('[data-note]') });
    });
  }
  function score(answered) {
    var s = SLIDES[cur], got = 0, tot = 0, n = 0, N = 0;
    Q.forEach(function (q, i) { if (s.key[i][0] === 'x') return; tot += q.w; N++; if (answered(i)) { got += q.w; n++; } });
    return { c: got / tot, n: n, N: N };
  }
  function verdict(c) { return c < 0.4 ? ['Not ready', 'not decision-ready: ask for the missing pieces first'] : c < 0.8 ? ['Ask first', 'promising, with gaps to close before acting'] : ['Ready', 'decision-ready, with the open items as known risks']; }
  function draw() {
    var s = SLIDES[cur], mine = score(function (i) { return ticks[cur][i]; }), key = score(function (i) { return s.key[i][0] === 'y'; });
    bKey.setAttribute('aria-pressed', showKey ? 'true' : 'false');
    bKey.textContent = showKey ? 'Hide the reviewer\'s key' : 'Check against the reviewer\'s key';
    items.forEach(function (it, i) {
      var st = s.key[i][0], note = s.key[i][1], t = ticks[cur][i], html = '', col = 'var(--muted)';
      if (st === 'x') html = showKey ? esc(note) : '';
      else if (showKey) {
        if (st === 'y' && t) { html = '✓ Answered. ' + esc(note); col = 'var(--good)'; }
        else if (st === 'y') { html = 'Missed: the slide does answer this. ' + esc(note); col = 'var(--warn)'; }
        else if (t) { html = 'Not really answered. ' + esc(note); col = 'var(--warn)'; }
        else { html = '✓ Correctly left open. ' + esc(note); col = 'var(--good)'; }
      }
      it.note.style.color = col; it.note.innerHTML = html; it.note.style.display = html ? '' : 'none';
    });
    // Meter: three zones, your reading as the bar, the key as a tick when shown.
    var SW = svg.parentElement.clientWidth || 640, narrow = SW < 520, x0 = 16, x1 = SW - 16, Xc = function (c) { return x0 + (x1 - x0) * c; }, g = '';
    [[0, 0.4, 'var(--warn-soft)', narrow ? 'not ready' : 'not decision-ready'], [0.4, 0.8, 'var(--lead-soft)', narrow ? 'ask first' : 'ask before acting'], [0.8, 1, 'var(--good-soft)', narrow ? 'ready' : 'decision-ready']].forEach(function (z) {
      g += '<rect x="' + Xc(z[0]) + '" y="22" width="' + (Xc(z[1]) - Xc(z[0])) + '" height="18" fill="' + z[2] + '" stroke="var(--line)"/>';
      g += '<text x="' + ((Xc(z[0]) + Xc(z[1])) / 2) + '" y="58" font-size="12.5" text-anchor="middle" fill="var(--muted)">' + z[3] + '</text>';
    });
    g += '<rect x="' + x0 + '" y="27" width="' + Math.max(0, Xc(mine.c) - x0) + '" height="8" rx="2" fill="var(--accent)"/>';
    var mx = Math.max(x0 + 62, Math.min(x1 - 62, Xc(mine.c)));
    g += '<text x="' + mx + '" y="15" font-size="13" text-anchor="middle" fill="var(--fg)">your reading: ' + G.pct(mine.c) + '</text>';
    if (showKey) g += '<line x1="' + Xc(key.c) + '" y1="18" x2="' + Xc(key.c) + '" y2="44" stroke="var(--fg)" stroke-width="2.5"/>' +
      '<text x="' + Math.max(x0 + 30, Math.min(x1 - 30, Xc(key.c))) + '" y="72" font-size="12" text-anchor="middle" fill="var(--fg)">key: ' + G.pct(key.c) + '</text>';
    svg.setAttribute('viewBox', '0 0 ' + SW + ' 74'); svg.innerHTML = g;
    k('n').textContent = G.fmt(mine.n, 0) + ' / ' + G.fmt(mine.N, 0); k('conf').textContent = G.pct(mine.c); k('verdict').textContent = verdict(mine.c)[0];
    var open = [];
    Q.forEach(function (q, i) {
      if (s.key[i][0] === 'x' || ticks[cur][i]) return;
      open.push('<li>' + esc(q.q) + ' → ' + q.L.map(function (l) { return '<a href="' + l[0] + '">' + l[1] + '</a>'; }).join(', ') + '</li>');
    });
    var msg = 'By your reading the slide answers <b>' + G.fmt(mine.n, 0) + ' of ' + G.fmt(mine.N, 0) + '</b> applicable questions, weighted confidence <b>' + G.pct(mine.c) + '</b>: ' + verdict(mine.c)[1] + '. ';
    if (showKey) {
      var miss = 0; Q.forEach(function (q, i) { if (s.key[i][0] !== 'x' && (s.key[i][0] === 'y') !== ticks[cur][i]) miss++; });
      msg += 'The reviewer\'s key says ' + G.fmt(key.n, 0) + ' of ' + G.fmt(key.N, 0) + ' (' + G.pct(key.c) + ', ' + verdict(key.c)[1] + '). ' + (miss ? 'You and the key differ on ' + G.fmt(miss, 0) + ' question' + (miss > 1 ? 's' : '') + '; the notes under each one explain why. ' : 'Your reading matches the key exactly. ');
    }
    msg += open.length ? 'Still open, so ask for these:<ul style="margin:6px 0 0;padding-left:20px">' + open.join('') + '</ul>' : 'Nothing left open.';
    msg += '<div style="font-size:12.5px;color:var(--muted);margin-top:6px">The meter is a rough heuristic: interval and seed questions count triple, six others double, the rest single, and not-applicable questions are left out. Use it to see gaps, not as a probability.</div>';
    out.innerHTML = msg;
  }
  G.on(bKey, 'click', function () { showKey = !showKey; draw(); });
  G.on(bClear, 'click', function () { ticks[cur] = Q.map(function () { return false; }); showKey = false; build(); draw(); });
  build();
  return draw;
});
