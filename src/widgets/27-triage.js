/* Chapter 27: walk a regression through the chapter's six checks, in any order, and see what skipping ahead costs.
   Cases and timings are illustrative. Each case's verdict needs checks 1..m of the chapter's order. */
G.widget('w-tg-flow', function (root) {
  var CHECKS = [
    { n: 'Is it real?', s: 'Paired interval on the delta', min: 10 },
    { n: 'Is it everywhere or somewhere?', s: 'Slice the delta by category, length, source', min: 20 },
    { n: 'Did anything non-model change?', s: 'Diff the config: harness, judge, task set, settings', min: 15 },
    { n: 'Error and retry rates', s: 'Timeouts, rate limits, failed calls', min: 10 },
    { n: 'Replay', s: "Previous model on today's harness", min: 90 },
    { n: 'Read the outputs', s: 'Twenty failures, by hand', min: 45 }
  ];
  var TAG = {
    clear: ['ruled out', 'var(--good)'], clue: ['points somewhere', 'var(--fn)'],
    decisive: ['decisive', 'var(--accent)'], confirms: ['confirms', 'var(--muted)']
  };
  var CASES = {
    a: { what: 'Coding suite pass rate', n: 400, before: 286, b: 28, c: 36, m: 1, verdict: 'Noise',
      action: 'No action: note it and move on.',
      f: [null,
        "Slices move between −4.3 and +2.0 points. The largest contribution is −0.75 of the −2.0 points, from 'strings' (70 tasks); the rest is spread thinly.",
        'Only the model checkpoint changed.',
        'Timeouts 0.8% → 0.9%, retries flat. Normal.',
        'The previous model on today\'s harness scores 70.8%, within noise of its original 71.5%.',
        'The usual mix: off-by-one bugs and a few format slips. Nothing new.'],
      t: ['decisive', 'clear', 'clear', 'clear', 'clear', 'clear'] },
    b: { what: 'Helpfulness pass rate (LLM-judged)', n: 600, before: 492, b: 12, c: 45, m: 3, verdict: 'Measurement',
      action: 'Fix the judge prompt, or rescore both models with the same one, and rerun before anyone discusses the model.',
      f: [null,
        'Uniform: every category drops 4 to 7 points. A uniform drop points at the model or the harness.',
        'The judge prompt changed on Tuesday: the rubric now fails any answer without a cited source. Nothing else changed besides the checkpoint.',
        'Errors and retries normal (0.5%).',
        'The previous model, rescored with today\'s judge, drops too: 82.0% → 76.2%.',
        'Most failures are good answers marked down for "no source" on questions that need none.'],
      t: [null, 'clue', 'decisive', 'clear', 'confirms', 'confirms'] },
    c: { what: 'Math accuracy', n: 500, before: 320, b: 10, c: 35, m: 3, verdict: 'Measurement',
      action: 'Restore the geometry reference answers and rescore. The model is not implicated.',
      f: [null,
        'Concentrated: geometry (80 of 500 tasks) fell 28.8 points and contributes −4.6 of the −5.0 points. Everything else contributes −0.4.',
        'The task data file changed: a new export script regenerated the geometry reference answers. Harness and settings are unchanged.',
        'Errors and timeouts normal (0.7%).',
        'The previous model, scored against today\'s task file, drops on geometry too.',
        'Geometry "failures" are correct answers graded against truncated references, for example 3.14 stored as "3."'],
      t: [null, 'clue', 'decisive', 'clear', 'confirms', 'confirms'] },
    d: { what: 'Agent task success rate', n: 300, before: 144, b: 8, c: 29, m: 4, verdict: 'Infrastructure',
      action: 'Rerun under healthy conditions, and report timeouts as errors rather than failures.',
      f: [null,
        'Concentrated: long tasks (90 of 300, over 20 tool calls) fell 20 points and contribute −6.0 of the −7.0 points.',
        'Only the checkpoint changed. Harness version, timeout and concurrency are identical.',
        'Timeouts jumped from 1.1% to 9.4%, nearly all on long tasks. The tool sandbox cluster was saturated during the run, and timeouts were scored as failures.',
        'Rerun tonight on a healthy cluster: the previous model scores 47.7% and the new one 47.3%.',
        'Most failures end mid-trajectory with "tool call timed out".'],
      t: [null, 'clue', 'clear', 'decisive', 'confirms', 'confirms'] },
    e: { what: 'Code generation pass@1', n: 500, before: 275, b: 14, c: 38, m: 6, verdict: 'Model',
      action: 'Escalate with the affected slice and example outputs.',
      f: [null,
        'Concentrated: multi-file edits (150 of 500 tasks) fell 13.3 points and contribute −4.0 of the −4.8 points. Single-function tasks are flat.',
        'Only the checkpoint changed.',
        'Timeouts and errors normal (0.6%).',
        'The previous model on today\'s harness scores 55.2%, unchanged. The drop follows the model.',
        '16 of 20 failures stop after editing the first file and report the task as done. A specific, new failure mode to hand to the training team.'],
      t: [null, 'clue', 'clear', 'clear', 'clue', 'decisive'] }
  };
  var EARLY = [null,
    'run before checking the drop is real. If it is noise, this time bought nothing.',
    'run before slicing, so you do not yet know whether the drop is everywhere or in one corner.',
    'run before diffing the config, the cheap way to rule out the harness and data.',
    'run before checking error rates, the cheap way to rule out infrastructure.',
    'run before the replay, so the model is not yet isolated.'];
  var sel = G.$(root, '#tg-case'), list = G.$(root, '[data-list]'), alertEl = G.$(root, '[data-alert]');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  var path = [];                        // [{i, early}] in click order
  function dur(m) { return m < 60 ? G.fmt(m, 0) + ' min' : G.fmt(Math.floor(m / 60), 0) + ' h' + (m % 60 ? ' ' + G.fmt(m % 60, 0) + ' min' : ''); }
  function pts(x) { var v = G.fmt(Math.abs(x) * 100, 1); return (v === '0.0' ? '' : x > 0 ? '+' : '−') + v; }
  function stats(C) {                   // paired comparison: b improved, c regressed, normal interval on the delta
    var d = (C.b - C.c) / C.n, se = Math.sqrt(C.b + C.c - (C.b - C.c) * (C.b - C.c) / C.n) / C.n;
    return { d: d, lo: d - 1.96 * se, hi: d + 1.96 * se, p0: C.before / C.n, p1: (C.before + C.b - C.c) / C.n };
  }
  function finding(C, i) {
    if (i > 0) return C.f[i];
    var s = stats(C);
    return 'Paired on the same ' + C.n + ' tasks: ' + C.c + ' went from pass to fail and ' + C.b + ' the other way. Delta ' + pts(s.d) + ' points, 95% interval ' +
      pts(s.lo) + ' to ' + pts(s.hi) + '. ' + (s.hi > 0 ? 'Zero is inside the interval: this is within noise.' : 'Zero is outside the interval: the drop is real.');
  }
  function noiseCase(C) { return C.m === 1; }
  function account(C) {                 // walk the path: needed, wasted, after verdict
    var done = {}, t = 0, verdictAt = null, waste = 0, wasted = [], segs = [];
    path.forEach(function (p) {
      var i = p.i, kind;
      if (verdictAt !== null) kind = 'after';
      else if (i < C.m || (i === 5 && !noiseCase(C))) kind = 'need';
      else { kind = 'waste'; waste += CHECKS[i].min; wasted.push(i); }
      segs.push({ i: i, t0: t, t1: t + CHECKS[i].min, kind: kind });
      t += CHECKS[i].min; done[i] = true;
      if (verdictAt === null) { var ok = true; for (var j = 0; j < C.m; j++) if (!done[j]) ok = false; if (ok) verdictAt = t; }
    });
    var ref = 0; for (var j = 0; j < C.m; j++) ref += CHECKS[j].min;
    return { t: t, verdictAt: verdictAt, waste: waste, wasted: wasted, segs: segs, ref: ref, done: done };
  }
  function renderList() {
    var C = CASES[sel.value], done = {};
    path.forEach(function (p) { done[p.i] = p; });
    list.innerHTML = CHECKS.map(function (ch, i) {
      var p = done[i], body = '';
      if (p) {
        var tg = TAG[C.t[i] || 'clear'];
        if (i === 0) tg = stats(C).hi > 0 ? TAG.decisive : TAG.clue;
        body = '<div class="tg-find"><span class="tg-tag" style="color:' + tg[1] + '">' + tg[0] + '</span>' + finding(C, i) +
          (p.early !== null ? '<span class="tg-ooo">Out of order: ' + EARLY[p.early + 1] + '</span>' : '') + '</div>';
      }
      return '<div class="tg-row' + (p ? ' done' : '') + '"><button class="tg-btn" data-i="' + i + '"' + (p ? ' disabled' : '') + '>' +
        '<span class="tg-n">' + (i + 1) + '</span><span class="tg-name"><b>' + ch.n + '</b><small>' + ch.s + '</small></span><span class="tg-cost">' + dur(ch.min) + '</span></button>' + body + '</div>';
    }).join('');
    G.$$(list, 'button[data-i]').forEach(function (b) { G.on(b, 'click', function () { reveal(+b.dataset.i); }); });
  }
  function reveal(i) {
    if (path.some(function (p) { return p.i === i; })) return;
    var early = null;
    for (var j = 0; j < i; j++) if (!path.some(function (p) { return p.i === j; })) { early = j; break; }
    path.push({ i: i, early: early });
    renderList(); draw();
  }
  G.on(G.$(root, '[data-next]'), 'click', function () {
    for (var i = 0; i < CHECKS.length; i++) if (!path.some(function (p) { return p.i === i; })) { reveal(i); return; }
  });
  G.on(G.$(root, '[data-reset]'), 'click', function () { path = []; renderList(); draw(); });
  G.on(sel, 'change', function () { path = []; renderList(); draw(); });

  function draw() {
    var C = CASES[sel.value], s = stats(C), A = account(C), P = G.pal();
    alertEl.innerHTML = '<b>Alert.</b> ' + C.what + ' fell from ' + G.pct(s.p0, 1) + ' to ' + G.pct(s.p1, 1) + ' (' + pts(s.p1 - s.p0) + ' points) on ' + C.n + ' tasks, a few hours before a launch review. Is anything actually wrong?';

    /* timeline: your path against the chapter's order */
    var total = 0; CHECKS.forEach(function (ch) { total += ch.min; });
    var c = G.canvas(cv, 168), ctx = c.ctx, L = 14, R = 14, W = c.w - L - R, X = function (m) { return L + m / total * W; };
    var rows = [{ y: 30, label: 'Your path' }, { y: 98, label: "The chapter's order" }], bh = 26;
    rows.forEach(function (r) { G.text(ctx, r.label, L, r.y - 12, P.muted, 'left', 12); ctx.fillStyle = P.sunk; ctx.fillRect(X(0), r.y, W, bh); });
    function block(y, seg, col, alpha, outline) {
      var x0 = X(seg.t0), x1 = X(seg.t1);
      if (outline) { ctx.strokeStyle = P.faint; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(x0 + 1, y + 1, x1 - x0 - 2, bh - 2); ctx.setLineDash([]); }
      else { ctx.fillStyle = col; ctx.globalAlpha = alpha; ctx.fillRect(x0 + 1, y, x1 - x0 - 2, bh); ctx.globalAlpha = 1; }
      if (x1 - x0 >= 14) G.text(ctx, String(seg.i + 1), (x0 + x1) / 2, y + bh / 2, outline ? P.faint : P.surface, 'center', 12);
    }
    var colour = { need: P.accent, waste: P.warn, after: P.tn };
    A.segs.forEach(function (sg) { block(rows[0].y, sg, colour[sg.kind], sg.kind === 'after' ? 0.7 : 1); });
    if (!path.length) G.text(ctx, 'Click a check above to start the clock', X(0) + 10, rows[0].y + bh / 2, P.faint, 'left', 12);
    var t = 0;
    CHECKS.forEach(function (ch, i) {
      var sg = { i: i, t0: t, t1: t + ch.min };
      if (i < C.m) block(rows[1].y, sg, P.accent, 1); else block(rows[1].y, sg, null, 1, true);
      t += ch.min;
    });
    function flag(y, at, txt) {
      var x = X(at);
      ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + bh + 4); ctx.stroke();
      var right = x > c.w - 150;
      G.text(ctx, txt, right ? x - 6 : x + 6, y + bh + 13, P.fg, right ? 'right' : 'left', 11.5);
    }
    if (A.verdictAt !== null) flag(rows[0].y, A.verdictAt, 'verdict at ' + dur(A.verdictAt));
    flag(rows[1].y, A.ref, 'verdict at ' + dur(A.ref));
    var lx = L, ly = c.h - 8;
    [[P.accent, 'needed'], [P.warn, 'not needed yet'], [P.tn, 'after the verdict']].forEach(function (it) {
      ctx.fillStyle = it[0]; ctx.fillRect(lx, ly - 5, 10, 10); G.text(ctx, it[1], lx + 14, ly, P.muted, 'left', 11.5); lx += ctx.measureText(it[1]).width + 30;
    });

    k('spent').textContent = path.length ? dur(A.t) : '0 min';
    k('ref').textContent = dur(A.ref);
    k('waste').textContent = dur(A.waste); k('waste').style.color = A.waste > 0 ? 'var(--warn)' : '';
    k('verdict').textContent = A.verdictAt !== null ? C.verdict : 'open';

    var msg;
    if (!path.length) {
      msg = 'Six checks, ordered so the cheapest questions come first. The chapter\'s order reaches a verdict on this incident in <b>' + dur(A.ref) + '</b>. Click the checks in any order, or use "Next check in order", and compare your timeline with the chapter\'s.';
    } else if (A.verdictAt === null) {
      var next = 0; while (A.done[next]) next++;
      msg = 'Time spent: <b>' + dur(A.t) + '</b>. Not enough evidence for a verdict yet. The next check in the chapter\'s order is <b>' + (next + 1) + '. ' + CHECKS[next].n + '</b> (' + dur(CHECKS[next].min) + ').';
      if (A.waste > 0) msg += ' So far ' + dur(A.waste) + ' went on checks this incident does not need before the cheap ones were done.';
    } else {
      msg = '<b>Verdict: ' + C.verdict + '.</b> ' + C.action + ' You reached it after <b>' + dur(A.verdictAt) + '</b>; the chapter\'s order gets there in ' + dur(A.ref) + '. ';
      if (A.waste > 0) msg += dur(A.waste) + ' of that went on ' + A.wasted.map(function (i) { return 'check ' + (i + 1) + ' (' + CHECKS[i].n + ')'; }).join(', ') + ', which this incident did not need yet. ';
      else msg += 'No time went on checks you did not need. ';
      if (C.m < 6 && !A.done[5] && C.m > 1) msg += 'Before closing, read twenty outputs anyway: the chapter says every time, and it is how you confirm the story.';
      else if (C.m === 1) msg += 'Most "regressions" end here, inside the noise' + (A.done[4] ? '.' : ', before anyone spends ' + dur(CHECKS[4].min) + ' on a replay.');
      else if (C.m === 6) msg += 'Only a model regression needs all six checks, because every cheaper explanation has to be ruled out first.';
    }
    out.innerHTML = msg;
  }
  renderList();
  return draw;
});
