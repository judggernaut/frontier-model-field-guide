/* Chapter 76: experiment design reviewer. Pick options for a proposed test; get flags, links and a grade. */
G.widget('w-ax-review', function (root) {
  var CH = { sampling: 'Who is in your sample?', randomization: 'Randomization', causation: 'Correlation is not causation', abtest: 'A/B tests end to end',
    metrics: 'Choosing metrics', evalstats: 'Statistics for eval sets', intervals: 'Intervals', gap: 'Offline–online gap' };
  var Q = [
    { k: 'sample', s: 'Sample', q: 'Who is in the test?', o: [
      ['all', 'All eligible users of the tier', 'ok', 'Matches the population the decision applies to.', 'sampling'],
      ['beta', 'Beta-program volunteers', 'major', 'Self-selected enthusiasts; their reaction rarely transfers to everyone.', 'sampling'],
      ['staff', 'Employees only', 'major', 'Not your users: different tasks, tolerance and devices.', 'sampling'],
      ['power', 'Last month’s most active users', 'minor', 'Heavy users react most to novelty and change; the effect may not generalise.', 'abtest']] },
    { k: 'assign', s: 'Assignment', q: 'How are users assigned?', o: [
      ['hash', 'Hash of user ID, fresh salt', 'ok', 'Random, reproducible, and independent of earlier tests.', 'randomization'],
      ['region', 'EU gets the new model, US keeps the old', 'major', 'Region is confounded with the model; any regional difference reads as a model effect.', 'causation'],
      ['days', 'New model on odd days', 'major', 'Confounded with weekday and news, and users switch models between days.', 'randomization'],
      ['opt', 'Users opt in from settings', 'major', 'Self-selection: people who opt in differ in ways that drive the metric.', 'causation']] },
    { k: 'unit', s: 'Unit', q: 'Unit of randomization', o: [
      ['user', 'User', 'ok', 'Consistent experience, and retention can be measured.', 'randomization'],
      ['session', 'Session', 'minor', 'Users meet both models across sessions; carryover blurs the contrast.', 'randomization'],
      ['request', 'Request', 'major', 'Users meet both models inside one conversation, so the treatment is no longer "the new model".', 'abtest']] },
    { k: 'metric', s: 'Primary metric', q: 'Primary metric', o: [
      ['plan', 'Pre-registered driver plus guardrails', 'ok', 'One decision metric, with latency, cost and safety guardrails set in advance.', 'metrics'],
      ['thumbs', 'Thumbs-up rate only', 'major', 'Sparse, favours flattery, and nothing guards cost, latency or safety.', 'metrics'],
      ['after', 'Whichever moves most, chosen afterwards', 'major', 'Forking paths: among 40 metrics, about two move by chance.', 'evalstats'],
      ['offline', 'Offline benchmark score', 'major', 'An offline score is not an online outcome; calibrate the gap first.', 'gap']] },
    { k: 'test', s: 'Analysis', q: 'Analysis', o: [
      ['cluster', 'Variance at the randomization unit (delta method)', 'ok', 'Standard errors match how units were assigned.', 'intervals'],
      ['naive', 't-test treating every request as independent', 'major', 'Requests from one user are correlated, so standard errors are too small and false wins follow.', 'metrics'],
      ['eyeball', 'Compare the dashboard lines', 'major', 'No interval and no error control, so noise gets read as signal.', 'evalstats']] },
    { k: 'size', s: 'Sample size', q: 'Sample size', o: [
      ['power', 'Power analysis for the MDE, whole weeks', 'ok', 'Sized to detect the smallest effect that would change the decision.', 'abtest'],
      ['three', 'Whatever arrives in 3 days', 'major', 'Underpowered and missing weekends; a null result says nothing.', 'abtest'],
      ['until', 'Run until it is significant', 'major', 'Optional stopping produces a "win" eventually, even with no effect.', 'abtest']] },
    { k: 'look', s: 'Looks', q: 'When will they look?', o: [
      ['once', 'Once, at the planned end', 'ok', 'One look keeps the false positive rate at its nominal level.', 'abtest'],
      ['seq', 'Weekly, pre-planned sequential boundary', 'ok', 'Interim looks are paid for by an alpha spending plan.', 'abtest'],
      ['daily', 'Daily, stop at the first p < 0.05', 'major', 'Peeking: 14 daily looks push the false positive rate above 20%.', 'abtest']] },
    { k: 'log', s: 'Logging', q: 'What is logged?', o: [
      ['full', 'Assignment, exposure, versions, trace IDs', 'ok', 'Exposed users can be analysed and any surprise can be traced.', 'metrics'],
      ['assign', 'Assignment only', 'major', 'No exposure or versions: effects are diluted and a surprise cannot be explained.', 'metrics'],
      ['agg', 'Aggregate dashboards only', 'major', 'No unit-level data: no SRM check, no correct variance, no debugging.', 'metrics']] }
  ];
  var PRE = {
    draft: { sample: 'all', assign: 'hash', unit: 'user', metric: 'thumbs', test: 'naive', size: 'power', look: 'daily', log: 'assign' },
    strong: { sample: 'all', assign: 'hash', unit: 'user', metric: 'plan', test: 'cluster', size: 'power', look: 'seq', log: 'full' }
  };
  var st = {}, qs = G.$(root, '[data-qs]'), pre = G.$$(root, '[data-preset]');
  Q.forEach(function (q) {
    var d = document.createElement('div'); d.className = 'ax-q';
    d.innerHTML = '<div class="q">' + q.q + '</div><div class="opts"></div>';
    var box = d.querySelector('.opts');
    q.o.forEach(function (o) {
      var b = document.createElement('button'); b.className = 'b'; b.type = 'button'; b.textContent = o[1]; b.dataset.k = q.k; b.dataset.v = o[0];
      G.on(b, 'click', function () { st[q.k] = o[0]; pre.forEach(function (p) { p.setAttribute('aria-pressed', 'false'); }); draw(); });
      box.appendChild(b);
    });
    qs.appendChild(d);
  });
  function setPreset(k) { for (var key in PRE[k]) st[key] = PRE[k][key]; pre.forEach(function (p) { p.setAttribute('aria-pressed', p.dataset.preset === k ? 'true' : 'false'); }); }
  pre.forEach(function (p) { G.on(p, 'click', function () { setPreset(p.dataset.preset); draw(); }); });
  setPreset('draft');
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function draw() {
    G.$$(qs, 'button').forEach(function (b) { b.setAttribute('aria-pressed', st[b.dataset.k] === b.dataset.v ? 'true' : 'false'); });
    var flags = [], pts = 0, nMaj = 0, nMin = 0;
    Q.forEach(function (q) {
      var o = q.o.filter(function (x) { return x[0] === st[q.k]; })[0], sev = o[2], msg = o[3], link = o[4];
      if (q.k === 'test' && o[0] === 'naive' && st.unit === 'request') { sev = 'minor'; msg = 'Matches the request unit, but one user sends many correlated requests; cluster by user.'; link = 'intervals'; }
      pts += sev === 'ok' ? 2 : sev === 'minor' ? 1 : 0; if (sev === 'major') nMaj++; if (sev === 'minor') nMin++;
      flags.push({ sev: sev, q: q.s, pick: o[1], msg: msg, link: link });
    });
    var order = { major: 0, minor: 1, ok: 2 };
    flags.sort(function (a, b) { return order[a.sev] - order[b.sev]; });
    G.$(root, '[data-flags]').innerHTML = flags.map(function (f) {
      return '<div class="ax-flag ' + f.sev + '"><div class="sev">' + (f.sev === 'ok' ? 'OK' : f.sev) + '</div><div><span class="k">' + esc(f.q) + ':</span> ' + esc(f.pick) + '. ' + esc(f.msg) +
        ' <a href="#' + f.link + '">→ ' + CH[f.link] + '</a></div></div>';
    }).join('');
    var g = pts >= 16 ? 'A' : pts >= 14 ? 'B' : pts >= 11 ? 'C' : pts >= 8 ? 'D' : 'F';
    var col = g === 'A' || g === 'B' ? 'var(--good)' : g === 'C' ? 'var(--lead)' : 'var(--fp)';
    var ge = G.$(root, '[data-grade]'); ge.textContent = g; ge.style.setProperty('--gc', col);
    var verdict = g === 'A' ? 'This design can support a launch decision. Write the decision table into the brief and run it.'
      : g === 'B' ? 'Close. The remaining issue weakens the result without invalidating it; fix it if it is cheap.'
      : g === 'C' ? 'Usable only with caveats a reviewer will ask about. Fix the flagged items before allocating traffic.'
      : 'This test cannot support a launch decision as designed. Each major flag alone can produce a confident wrong answer.';
    G.$(root, '[data-sum]').innerHTML = '<b>' + G.fmt(nMaj, 0) + ' major, ' + G.fmt(nMin, 0) + ' minor</b> (score ' + G.fmt(pts, 0) + ' of 16). ' + verdict;
  }
  return draw;
});
