/* Chapter 38: PPO clip visualizer and a closed-form bandit RLHF simulation */
G.widget('w-rl-clip', function (root) {
  var se = G.$(root, '#rl-clip-e'), cv = G.$(root, 'canvas');
  function clip(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function draw() {
    var P = G.pal(), eps = parseFloat(se.value);
    G.$(root, '#rl-clip-e-o').textContent = G.fmt(eps, 2);
    var narrow = (cv.parentElement.clientWidth || 640) < 560, H = narrow ? 480 : 250;
    var c = G.canvas(cv, H), ctx = c.ctx;
    [1, -1].forEach(function (A, k) {
      var pad = narrow ? { l: 46, r: 14, t: 24 + k * 240, b: 36 + (1 - k) * 240 } : { l: 46 + k * c.w / 2, r: 14 + (1 - k) * c.w / 2, t: 24, b: 36 };
      var s = G.axes(ctx, c.w, H, pad, { x: [0, 2], y: A > 0 ? [0, 2] : [-2, 0], xt: [0, 0.5, 1, 1.5, 2], yt: A > 0 ? [0, 1, 2] : [-2, -1, 0], xl: 'probability ratio π_new / π_old', yl: k === 0 || narrow ? 'objective' : '' });
      var x0 = A > 0 ? 1 + eps : 0, x1 = A > 0 ? 2 : 1 - eps;
      ctx.fillStyle = P.sunk; ctx.fillRect(s.X(x0), pad.t, s.X(x1) - s.X(x0), H - pad.t - pad.b);
      var un = [], cl = [];
      for (var r = 0; r <= 2.0001; r += 0.01) {
        un.push([s.X(r), s.Y(r * A)]);
        cl.push([s.X(r), s.Y(Math.min(r * A, clip(r, 1 - eps, 1 + eps) * A))]);
      }
      G.line(ctx, un, P.faint, 1.5, [5, 4]);
      G.line(ctx, cl, A > 0 ? P.tp : P.fp, 2.8);
      G.dot(ctx, s.X(1), s.Y(A), 5, P.fg, P.surface);
      G.text(ctx, A > 0 ? 'advantage > 0 (good action)' : 'advantage < 0 (bad action)', pad.l + 2, pad.t - 12, A > 0 ? P.tp : P.fp);
      G.text(ctx, 'flat: no gradient', (s.X(x0) + s.X(x1)) / 2, A > 0 ? s.Y(0.4) : s.Y(-1.6), P.muted, 'center', 11);
    });
    G.$(root, '[data-out]').textContent = 'With ε = ' + G.fmt(eps, 2) + ', a good action can gain at most a factor of ' + G.fmt(1 + eps, 2) +
      ' in probability per update before its gradient switches off, and a bad action can be cut to ' + G.fmt(1 - eps, 2) +
      ' of its old probability. The pessimistic min keeps the penalty when an update has already gone the wrong way (ratio above 1 for a bad action).';
  }
  G.on(se, 'input', draw);
  return draw;
});

G.widget('w-rl-bandit', function (root) {
  var sb = G.$(root, '#rl-band-b'), sl = G.$(root, '#rl-band-l'), cvs = G.$$(root, 'canvas');
  var R = [
    { n: 'Short, correct', t: 0.8, len: 0.2, ref: 0.30 },
    { n: 'Long, thorough, correct', t: 1.0, len: 0.7, ref: 0.20 },
    { n: 'Long, padded, confident', t: 0.3, len: 1.0, ref: 0.15 },
    { n: 'Short, wrong', t: -0.5, len: 0.1, ref: 0.25 },
    { n: 'Refusal, not needed', t: -0.2, len: 0.15, ref: 0.10 }
  ];
  function solve(beta, bias) {
    var w = R.map(function (r) { return Math.log(r.ref) + (r.t + bias * r.len) / beta; });
    var p = G.softmax(w), kl = 0, tr = 0, px = 0;
    p.forEach(function (pi, i) { if (pi > 0) kl += pi * Math.log(pi / R[i].ref); tr += pi * R[i].t; px += pi * (R[i].t + bias * R[i].len); });
    return { p: p, kl: kl, tr: tr, px: px };
  }
  function draw() {
    var P = G.pal(), beta = Math.pow(10, parseFloat(sb.value)), bias = parseFloat(sl.value);
    G.$(root, '#rl-band-b-o').textContent = beta < 0.1 ? G.fmt(beta, 3) : G.fmt(beta, 2);
    G.$(root, '#rl-band-l-o').textContent = G.fmt(bias, 1);
    var sol = solve(beta, bias);
    // bars: reference vs optimised policy
    var c = G.canvas(cvs[0], 230), ctx = c.ctx, pad = { l: 46, r: 12, t: 16, b: 46 };
    var s = G.axes(ctx, c.w, c.h, pad, { x: [0, R.length], y: [0, 1], yt: [0, 0.5, 1], yf: function (t) { return G.pct(t); }, yl: 'share of responses' });
    var gw = (c.w - pad.l - pad.r) / R.length, bw = Math.min(26, gw * 0.32);
    R.forEach(function (r, i) {
      var cx = pad.l + gw * (i + 0.5);
      ctx.fillStyle = P.tn; ctx.fillRect(cx - bw - 2, s.Y(r.ref), bw, s.Y(0) - s.Y(r.ref));
      ctx.fillStyle = P.accent; ctx.fillRect(cx + 2, s.Y(sol.p[i]), bw, s.Y(0) - s.Y(sol.p[i]));
      var words = r.n.split(', ');
      words.forEach(function (wd, j) { G.text(ctx, wd + (j < words.length - 1 ? ',' : ''), cx, c.h - pad.b + 12 + j * 13, P.muted, 'center', 10.5); });
    });
    G.text(ctx, 'reference policy (grey) vs RLHF policy (colour)', pad.l + 4, 8, P.muted);
    // curves vs beta
    var c2 = G.canvas(cvs[1], 220), ctx2 = c2.ctx, pad2 = { l: 46, r: 14, t: 16, b: 36 };
    var lo = -2, hi = 1, ymax = 1 + bias + 0.2;
    var s2 = G.axes(ctx2, c2.w, c2.h, pad2, { x: [lo, hi], y: [-0.2, ymax], xt: [-2, -1, 0, 1], xf: function (t) { return t === -2 ? '0.01' : t === -1 ? '0.1' : t === 0 ? '1' : '10'; }, yt: [0, Math.round(ymax * 10) / 20, Math.round(ymax * 10) / 10], yf: function (t) { return G.fmt(t, 1); }, xl: 'KL coefficient β (log scale)  ← less restraint', yl: 'expected reward' });
    var tp = [], pp = [];
    for (var v = lo; v <= hi + 1e-9; v += 0.02) { var q = solve(Math.pow(10, v), bias); tp.push([s2.X(v), s2.Y(q.tr)]); pp.push([s2.X(v), s2.Y(q.px)]); }
    G.line(ctx2, pp, P.fn, 2.3); G.line(ctx2, tp, P.tp, 2.3);
    var bv = parseFloat(sb.value);
    G.line(ctx2, [[s2.X(bv), pad2.t], [s2.X(bv), c2.h - pad2.b]], P.fg, 1.2, [4, 3]);
    G.dot(ctx2, s2.X(bv), s2.Y(sol.px), 5, P.fn, P.surface); G.dot(ctx2, s2.X(bv), s2.Y(sol.tr), 5, P.tp, P.surface);
    G.text(ctx2, 'reward model score', s2.X(-1.95), s2.Y(solve(0.0112, bias).px) + 14, P.fn);
    G.text(ctx2, 'true quality', s2.X(0.35), s2.Y(solve(Math.pow(10, 0.35), bias).tr) - 12, P.tp);
    var ref = solve(1e6, bias);
    G.$(root, '[data-kl]').textContent = G.fmt(sol.kl, 2);
    G.$(root, '[data-px]').textContent = (sol.px - ref.px >= 0 ? '+' : '') + G.fmt(sol.px - ref.px, 2);
    G.$(root, '[data-tr]').textContent = (sol.tr - ref.tr >= 0 ? '+' : '') + G.fmt(sol.tr - ref.tr, 2);
    var best = 0; sol.p.forEach(function (x, i) { if (x > sol.p[best]) best = i; });
    G.$(root, '[data-out]').textContent = 'The optimal policy for the KL-regularised objective is π*(y) ∝ π_ref(y)·exp(r(y)/β), computed exactly here. At β = ' +
      (beta < 0.1 ? G.fmt(beta, 3) : G.fmt(beta, 2)) + ' the most common response is "' + R[best].n + '". ' +
      (function () { var bt = -1e9, bb = 0; for (var v = -2; v <= 1.0001; v += 0.02) { var q = solve(Math.pow(10, v), bias); if (q.tr > bt) { bt = q.tr; bb = Math.pow(10, v); } }
        return sol.tr < bt - 0.03 ? 'True quality is ' + G.fmt(bt - sol.tr, 2) + ' below the best achievable here (at β ≈ ' + G.fmt(bb, 2) + '), even though the reward model score is higher. ' : 'This is close to the best true quality this reward model allows. '; })() +
      'Lower β lets the policy move further from the reference (higher KL) and exploit the reward model more.';
  }
  G.on([sb, sl], 'input', draw);
  return draw;
});

/* Chapter 48: GAE on a short response. Same recursion as the chapter's gae():
   delta_t = r_t + gamma * V(s_{t+1}) - V(s_t), with V = 0 after the final token;
   A_t = delta_t + gamma * lambda * A_{t+1}. */
G.widget('w-rl-gae', function (root) {
  var sg = G.$(root, '#rl-gae-g'), sl = G.$(root, '#rl-gae-l'), cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  var RW = {
    end: [0, 0, 0, 0, 0, 0, 0, 1],
    kl: [-0.02, -0.05, -0.01, -0.03, -0.02, -0.04, -0.01, 0.9],
    ex: [-0.01, -0.02, 0.9]
  };
  var CR = {
    ramp: function (u) { return 0.4 + 0.5 * u; },
    flat: function () { return 0.5; },
    zero: function () { return 0; }
  };
  var rewards = RW.end.slice(), values = [], rwName = 'end', crName = 'ramp', edit = 'r';
  function applyCritic(name) {
    var T = rewards.length;
    values = rewards.map(function (_, t) { return Math.round(CR[name](T > 1 ? t / (T - 1) : 0) * 100) / 100; });
  }
  applyCritic('ramp');
  function press(sel, attr, name) { G.$$(root, sel).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset[attr] === name ? 'true' : 'false'); }); }
  G.$$(root, 'button[data-rw]').forEach(function (b) {
    G.on(b, 'click', function () {
      rwName = b.dataset.rw; rewards = RW[rwName].slice();
      if (rwName === 'ex') { values = [0.5, 0.6, 0.7]; crName = ''; } else { if (!crName) crName = 'ramp'; applyCritic(crName); }
      press('button[data-rw]', 'rw', rwName); press('button[data-cr]', 'cr', crName); draw();
    });
  });
  G.$$(root, 'button[data-cr]').forEach(function (b) {
    G.on(b, 'click', function () { crName = b.dataset.cr; applyCritic(crName); press('button[data-cr]', 'cr', crName); draw(); });
  });
  G.$$(root, 'button[data-ed]').forEach(function (b) {
    G.on(b, 'click', function () { edit = b.dataset.ed; press('button[data-ed]', 'ed', edit); });
  });
  function gae(r, v, gamma, lam) {
    var T = r.length, adv = new Array(T), delta = new Array(T), last = 0;
    for (var t = T - 1; t >= 0; t--) {
      var nextV = t + 1 < T ? v[t + 1] : 0;          // no value after the final token
      delta[t] = r[t] + gamma * nextV - v[t];
      last = delta[t] + gamma * lam * last;            // discounted sum of future deltas
      adv[t] = last;
    }
    return { adv: adv, delta: delta };
  }
  var geo = null, RANGE = [-1, 1.5];
  function niceMax(m) { var steps = [0.5, 1, 1.5, 2, 3, 4, 6]; for (var i = 0; i < steps.length; i++) if (m <= steps[i]) return steps[i]; return Math.ceil(m); }
  function draw() {
    var P = G.pal(), gamma = +sg.value, lam = +sl.value, T = rewards.length;
    G.$(root, '#rl-gae-g-o').textContent = G.fmt(gamma, 2); G.$(root, '#rl-gae-l-o').textContent = G.fmt(lam, 2);
    var g = gae(rewards, values, gamma, lam), g0 = gae(rewards, values, gamma, 0), g1 = gae(rewards, values, gamma, 1);
    var m = 0.25;
    [g.adv, g.delta, g0.adv, g1.adv].forEach(function (a) { a.forEach(function (x) { m = Math.max(m, Math.abs(x)); }); });
    var M = niceMax(m * 1.08);
    var ph = 118, gap = 30, c = G.canvas(cv, 3 * ph + 2 * gap + 30), ctx = c.ctx, L = 46, R = 12;
    var slot = (c.w - L - R) / T, bw = Math.min(34, slot * 0.5), showVals = slot >= 40;
    var panels = [
      { y0: 18, lo: RANGE[0], hi: RANGE[1], ticks: [-1, 0, 1], title: 'Rewards r_t (bars) and critic V(s_t) (line). Drag here to edit ' + (edit === 'r' ? 'rewards' : 'values') + '.' },
      { y0: 18 + ph + gap, lo: -M, hi: M, ticks: [-M, 0, M], title: 'TD errors δ_t = r_t + γ·V(s_t+1) − V(s_t)' },
      { y0: 18 + 2 * (ph + gap), lo: -M, hi: M, ticks: [-M, 0, M], title: 'GAE advantages Â_t = δ_t + γλ·Â_t+1' }
    ];
    panels.forEach(function (p) {
      p.Y = function (v) { return p.y0 + 16 + (p.hi - v) / (p.hi - p.lo) * (ph - 16); };
      G.text(ctx, p.title, L, p.y0 + 2, P.muted, 'left', 11.5);
      p.ticks.forEach(function (t) {
        ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.globalAlpha = t === 0 ? 1 : 0.6;
        ctx.beginPath(); ctx.moveTo(L, p.Y(t)); ctx.lineTo(c.w - R, p.Y(t)); ctx.stroke(); ctx.globalAlpha = 1;
        G.text(ctx, G.fmt(t, Math.abs(t) % 1 ? 1 : 0), L - 6, p.Y(t), P.faint, 'right', 11);
      });
    });
    function X(t) { return L + slot * (t + 0.5); }
    function bar(p, t, v, col, w) {
      var y0 = p.Y(0), y1 = p.Y(Math.max(p.lo, Math.min(p.hi, v)));
      ctx.fillStyle = col; ctx.fillRect(X(t) - w / 2, Math.min(y0, y1), w, Math.max(1, Math.abs(y1 - y0)));
      if (showVals && Math.abs(v) >= 0.005) G.text(ctx, G.fmt(v, 2), X(t), v >= 0 ? Math.min(y0, y1) - 8 : Math.max(y0, y1) + 9, P.fg, 'center', 10.5);
    }
    // panel 1: rewards and critic
    var p1 = panels[0];
    rewards.forEach(function (r, t) { bar(p1, t, r, P.accent, bw); });
    G.line(ctx, values.map(function (v, t) { return [X(t), p1.Y(v)]; }), P.fn, 2);
    values.forEach(function (v, t) { G.dot(ctx, X(t), p1.Y(v), 4.5, P.fn, P.surface); });
    // panel 2: TD errors
    g.delta.forEach(function (d, t) { bar(panels[1], t, d, P.eli5, bw); });
    // panel 3: advantages, with the lambda = 0 and lambda = 1 answers as markers
    var p3 = panels[2];
    g.adv.forEach(function (a, t) { bar(p3, t, a, a >= 0 ? P.tp : P.fp, bw); });
    g0.adv.forEach(function (a, t) {
      ctx.beginPath(); ctx.arc(X(t) - bw / 2 - 7, p3.Y(a), 4, 0, 2 * Math.PI); ctx.strokeStyle = P.fg; ctx.lineWidth = 1.5; ctx.stroke();
    });
    g1.adv.forEach(function (a, t) {
      var x = X(t) + bw / 2 + 7, y = p3.Y(a);
      ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.fillStyle = P.fg; ctx.fill();
    });
    var yb = 18 + 3 * ph + 2 * gap + 14;
    for (var t = 0; t < T; t++) G.text(ctx, (slot >= 40 ? 'token ' : '') + (t + 1), X(t), yb, P.faint, 'center', 11);
    geo = { p1: p1, L: L, slot: slot, T: T };

    // numbers for the cards and the readout
    var gl = gamma * lam, w0 = Math.pow(gl, T - 1);
    var critic = 0; for (var mm = 1; mm <= T - 1; mm++) critic += gamma * (1 - lam) * Math.pow(gl, mm - 1);
    var ret0 = 0; for (t = T - 1; t >= 0; t--) ret0 = rewards[t] + gamma * ret0;
    k('gl').textContent = G.fmt(gl, 2);
    k('hz').textContent = gl >= 0.9995 ? 'all ' + T : G.fmt(Math.min(1 / (1 - gl), 999), 1) + ' tokens';
    k('w0').textContent = G.fmt(w0, 3);
    k('a0').textContent = G.fmt(g.adv[0], 3);
    var s = 'Token 1 sees the reward on the last token with weight (γλ)<sup>' + (T - 1) + '</sup> = <b>' + G.fmt(w0, 3) + '</b>, and leans on the critic\'s guesses about later tokens with total weight <b>' + G.fmt(critic, 2) + '</b>. ';
    if (lam <= 0.05) s += 'At λ ≈ 0 each advantage is a single TD error: one reward and two critic guesses. That barely changes from one sampled response to the next (low variance), but if the critic is wrong, every advantage is wrong in the same direction (bias). ';
    else if (lam >= 0.95 && gamma >= 0.995) s += 'At λ near 1 with γ = 1 the advantage is close to the actual sum of remaining rewards minus V(s<sub>t</sub>). The critic only acts as a baseline, so its errors add little bias, but every later token\'s luck lands on every earlier token (high variance). ';
    else s += 'In between, GAE blends the two: near tokens are judged by real rewards, far tokens through the critic. Lower λ means less variance and more trust in the critic. ';
    if (crName === 'flat' && lam <= 0.5 && rwName === 'end') s += 'With a flat critic and a reward only at the end, the middle TD errors are zero, so early tokens get almost no credit at low λ. ';
    if (crName === 'zero') s += 'With no critic, each TD error is just the reward, so λ below 1 simply discounts later rewards away; only λ = 1 gives the plain REINFORCE signal (all remaining reward), with its full variance. ';
    if (gamma < 0.995) s += 'γ = ' + G.fmt(gamma, 2) + ' shrinks the reward itself on the way back (return from token 1: ' + G.fmt(ret0, 3) + '), which changes what the policy is optimising. λ only changes how the advantage is estimated, which is why RLHF keeps γ = 1 and tunes λ.';
    else s += 'RLHF usually keeps γ = 1 and λ around 0.95: almost the full reward signal, with the critic trimming some variance.';
    out.innerHTML = s;
  }
  // dragging on the top panel edits rewards or values
  var dragging = false;
  function setFrom(ev) {
    if (!geo) return;
    var rect = cv.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top, p = geo.p1;
    var t = Math.floor((x - geo.L) / geo.slot);
    if (t < 0 || t >= geo.T) return;
    var v = p.hi - (y - p.y0 - 16) / (118 - 16) * (p.hi - p.lo);
    v = Math.max(p.lo, Math.min(p.hi, Math.round(v * 20) / 20));
    if (edit === 'r') { rewards[t] = v; rwName = ''; press('button[data-rw]', 'rw', ''); }
    else { values[t] = v; crName = ''; press('button[data-cr]', 'cr', ''); }
    draw();
  }
  G.on(cv, 'pointerdown', function (ev) {
    if (!geo) return;
    var rect = cv.getBoundingClientRect(), y = ev.clientY - rect.top;
    if (y > geo.p1.y0 + 118 + 6) return;
    dragging = true; cv.setPointerCapture(ev.pointerId); setFrom(ev);
  });
  G.on(cv, 'pointermove', function (ev) {
    if (dragging) { setFrom(ev); return; }
    if (geo) cv.style.cursor = ev.clientY - cv.getBoundingClientRect().top <= geo.p1.y0 + 118 + 6 ? 'ns-resize' : 'default';
  });
  G.on(cv, 'pointerup', function () { dragging = false; });
  G.on(cv, 'pointercancel', function () { dragging = false; });
  G.on([sg, sl], 'input', draw);
  return draw;
});
