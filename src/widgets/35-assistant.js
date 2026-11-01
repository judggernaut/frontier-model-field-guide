/* Chapter 35: From predictor to assistant. Two widgets: same predictor / different document, and overconfidence vs grading. */

G.widget('w-as-doc', function (root) {
  var ms = G.$(root, '#as-doc-m'), ds = G.$(root, '#as-doc-d'), box = G.$(root, '[data-doc]'), cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var Q = 'What is the capital of Australia?';
  function chat(sys, user) {
    return (sys ? '<|im_start|>system\n' + sys + '<|im_end|>\n' : '') + '<|im_start|>user\n' + user + '<|im_end|>\n<|im_start|>assistant\n';
  }
  var DOCS = {
    plain: Q,
    quiz: 'Geography quiz\n1. What is the capital of France?\nAnswer: Paris\n2. ' + Q + '\nAnswer:',
    chat: chat('', Q),
    system: chat('You are a pirate. Answer in one short sentence.', Q),
    push: chat('', 'The capital of Australia is Sydney, right?')
  };
  // Hand-written, illustrative continuations and first-token probabilities.
  var C = {
    base: {
      plain: ['\nWhat is the capital of Canada?\nWhat is the capital of Brazil?\nWhat is the capital of', [['\\n', .46], [' The', .14], [' Canberra', .09], [' (', .06], [' What', .05]],
        'The base model treats the bare question as one line of a list, which is common on the web, so it writes more questions. It "knows" the answer; this document just does not call for it.'],
      quiz: [' Canberra\n3. What is the capital of Japan?\nAnswer: Tokyo', [[' Canberra', .71], [' Sydney', .17], [' Melbourne', .05], [' Can', .02], [' The', .02]],
        'A quiz sheet with a worked example makes an answer the likely continuation. This is few-shot prompting. Note the 17% on "Sydney": the common mistake is in the training data too. Then it keeps writing the quiz.'],
      chat: ['The capital of Australia is Canberra.<|im_end|>\n<|im_start|>user\nAnd New Zealand?<|im_end|>\n<|im_start|>assistant\nWellington.', [['The', .32], ['Canberra', .21], ['Sydney', .08], ['I', .06], ['What', .05]],
        'A base model that saw chat-formatted text on the web can continue the template, but nothing taught it to stop at the end of its turn, so it writes the user\'s next message too. It is continuing a transcript, playing every part.'],
      system: ['The capital of Australia is Canberra, matey.<|im_end|>\n<|im_start|>user\nArr! What about', [['The', .30], ['Arr', .18], ['Canberra', .14], ['Ahoy', .07], ['I', .05]],
        'The system prompt does pull the base model toward the pirate voice, but weakly: it was never trained to treat that block as instructions, only as more text. It also runs on into the next user turn.'],
      push: ['Yes, Sydney is the capital of Australia.<|im_end|>\n<|im_start|>user\nThanks!', [['Yes', .34], ['No', .30], ['Actually', .12], ['The', .08], ['Sydney', .05]],
        'Agreeing and correcting are both common continuations of this kind of exchange online, so the base model is close to a coin flip. Without post-training, nothing favours the true answer over the agreeable one.']
    },
    chat: {
      plain: ['\n\nThe capital of Australia is Canberra.', [['\\n\\n', .41], ['The', .30], [' Canberra', .14], [' The', .07], ['?', .02]],
        'Even without a template, the tuned model has learned that questions get answers. The whole distribution shifted toward replying, because the weights changed.'],
      quiz: [' Canberra', [[' Canberra', .93], [' Sydney', .03], [' The', .02], [' Can', .01], [' Melbourne', .01]],
        'The tuned model answers and stops. It also puts less weight on the common wrong answer than the base model did here; that is often good, but post-training also tends to make confidence more extreme overall (see calibration below).'],
      chat: ['The capital of Australia is Canberra.<|im_end|>', [['The', .62], ['Canberra', .31], ['Australia', .03], ['It', .02], ['Sydney', .01]],
        'This is the document the assistant was trained to continue. It answers in the assistant\'s voice and emits the end-of-turn token, so the serving code hands control back to you.'],
      system: ['Arr, the capital be Canberra, matey!<|im_end|>', [['Arr', .78], ['Ahoy', .12], ['The', .04], ['Aye', .03], ['Canberra', .01]],
        'The same system prompt now dominates the reply, because SFT and RLHF trained the model to weight the system block heavily. It is still just tokens; the difference is entirely in the weights.'],
      push: ['Actually, the capital is Canberra. Sydney is the largest city, which is a common mix-up.<|im_end|>', [['Actually', .48], ['No', .22], ['Yes', .09], ['Not', .08], ['That', .05]],
        'A well-tuned assistant corrects politely. Note the 9% left on "Yes": preference training that over-rewards agreement grows that share, which is how sycophancy appears (Sharma et al. 2023).']
    }
  };
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmtDoc(s, cls) {
    // highlight special tokens as chips
    return esc(s).replace(/&lt;\|(im_start|im_end)\|&gt;/g, function (m) {
      return '<span style="font-size:11.5px;padding:0 4px;border-radius:4px;border:1px solid var(--line-strong);background:var(--sunk);color:var(--muted)">' + m + '</span>';
    });
  }
  function draw() {
    var P = G.pal(), m = ms.value, d = ds.value, c = C[m][d];
    box.innerHTML = '<span style="color:var(--fg)">' + fmtDoc(DOCS[d]) + '</span><span style="color:var(--accent);font-weight:600">' + fmtDoc(c[0]) + '</span>';
    var rows = c[1], k = G.canvas(cv, 34 + rows.length * 26), ctx = k.ctx, lx = 104, bw = k.w - lx - 64;
    G.text(ctx, 'first token the model adds (illustrative probabilities)', 8, 12, P.muted, 'left', 12);
    rows.forEach(function (r, i) {
      var y = 28 + i * 26, lab = r[0].replace(/^ /, '␣');
      G.text(ctx, lab, lx - 8, y + 10, P.fg, 'right', 13);
      ctx.fillStyle = P.sunk; ctx.fillRect(lx, y + 1, bw, 18);
      ctx.fillStyle = i === 0 ? P.accent : P.accentSoft; ctx.fillRect(lx, y + 1, Math.max(1, bw * r[1]), 18);
      if (i) { ctx.strokeStyle = P.accent; ctx.lineWidth = 1; ctx.strokeRect(lx + .5, y + 1.5, Math.max(1, bw * r[1]) - 1, 17); }
      G.text(ctx, G.pct(r[1]), lx + bw * r[1] + 6, y + 10, P.muted, 'left', 12);
    });
    out.innerHTML = '<b>' + (m === 'base' ? 'Base model' : 'Assistant') + ':</b> ' + c[2];
  }
  G.on([ms, ds], 'change', draw);
  return draw;
});

G.widget('w-as-cal', function (root) {
  var ss = G.$(root, '#as-cal-s'), so = G.$(root, '#as-cal-s-o'), gs = G.$(root, '#as-cal-g'), cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var k = function (n) { return G.$(root, '[data-' + n + ']'); };
  var N = 2000, r = G.rng(7), p = [], ok = [];
  for (var i = 0; i < N; i++) { var pi = G.sigmoid(1.7 * G.gauss(r) + 0.5); p.push(pi); ok.push(r() < pi ? 1 : 0); }
  function logit(x) { return Math.log(x / (1 - x)); }
  function sim(s, pen) {
    var a = 1 + 2.5 * s, b = 1.2 * s, t = pen / (1 + pen), conf = [], ans = 0, right = 0, wrong = 0;
    var bins = []; for (var j = 0; j < 10; j++) bins.push({ n: 0, c: 0, a: 0 });
    for (var i = 0; i < N; i++) {
      var c = G.sigmoid(a * logit(p[i]) + b); conf.push(c);
      var bi = Math.min(9, Math.floor(c * 10)); bins[bi].n++; bins[bi].c += c; bins[bi].a += ok[i];
      if (c > t) { ans++; if (ok[i]) right++; else wrong++; }
    }
    var ece = 0; bins.forEach(function (B) { if (B.n) ece += B.n / N * Math.abs(B.a / B.n - B.c / B.n); });
    return { bins: bins, ece: ece, right: right / N, wrong: wrong / N, idk: 1 - ans / N, score: (right - pen * wrong) / N, t: t };
  }
  function draw() {
    var P = G.pal(), s = +ss.value, pen = +gs.value, R = sim(s, pen), R0 = sim(0, pen);
    so.textContent = G.fmt(s, 2);
    var wide = (cv.parentElement.clientWidth || 640) >= 620;
    var c = G.canvas(cv, wide ? 290 : 505), ctx = c.ctx;
    // Reliability diagram.
    var pw = wide ? c.w * 0.5 - 10 : c.w, ph = 270;
    var ax = G.axes(ctx, pw, ph, { l: 44, r: 14, t: 24, b: 36 }, { x: [0, 1], y: [0, 1], xt: [0, .25, .5, .75, 1], yt: [0, .5, 1], xf: G.pct, yf: G.pct, xl: 'stated confidence', yl: 'actual accuracy' });
    if (pen > 0) {
      ctx.save(); ctx.fillStyle = P.sunk; ctx.globalAlpha = 0.5; ctx.fillRect(ax.X(0), ax.Y(1), ax.X(R.t) - ax.X(0), ax.Y(0) - ax.Y(1)); ctx.restore();
      G.text(ctx, 'abstains here', ax.X(R.t / 2), ax.Y(0.08), P.muted, 'center', 11);
    }
    G.line(ctx, [[ax.X(0), ax.Y(0)], [ax.X(1), ax.Y(1)]], P.faint, 1.5, [4, 4]);
    var pts = [];
    R.bins.forEach(function (B, j) { if (B.n >= 25) pts.push([ax.X(B.c / B.n), ax.Y(B.a / B.n), B.n]); });
    G.line(ctx, pts.map(function (q) { return [q[0], q[1]]; }), P.accent, 2);
    pts.forEach(function (q) { G.dot(ctx, q[0], q[1], 2.5 + Math.sqrt(q[2]) / 5, P.accent); });
    G.text(ctx, 'dashed = honest confidence', ax.X(1), ax.Y(0.05), P.faint, 'right', 11);
    // Outcome bars.
    var ox = wide ? c.w * 0.5 + 20 : 16, oy = wide ? 34 : ph + 34, ow = (wide ? c.w * 0.5 - 40 : c.w - 32);
    G.text(ctx, 'what happens to the 2,000 questions', ox, oy - 14, P.muted, 'left', 12);
    var rows = [['Correct', R.right, R0.right, P.good], ['Wrong answer', R.wrong, R0.wrong, P.warn], ['"I don\'t know"', R.idk, R0.idk, P.faint]];
    var lw = 132, bw = ow - lw - 50;
    rows.forEach(function (q, j) {
      var y = oy + j * 64;
      G.text(ctx, q[0], ox, y + 12, P.fg, 'left', 13);
      ctx.fillStyle = P.sunk; ctx.fillRect(ox + lw, y + 2, bw, 20);
      ctx.fillStyle = q[3]; ctx.fillRect(ox + lw, y + 2, Math.max(1, bw * q[1]), 20);
      G.text(ctx, G.pct(q[1]), ox + lw + bw * q[1] + 6, y + 12, P.fg, 'left', 12);
      ctx.strokeStyle = P.fg; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(ox + lw + bw * q[2], y - 2); ctx.lineTo(ox + lw + bw * q[2], y + 26); ctx.stroke(); ctx.setLineDash([]);
      G.text(ctx, 'calibrated model: ' + G.pct(q[2]), ox + lw, y + 38, P.muted, 'left', 11);
    });
    k('ece').textContent = G.fmt(R.ece, 3);
    k('wrong').textContent = G.pct(R.wrong);
    k('idk').textContent = G.pct(R.idk);
    k('score').textContent = G.fmt(R.score, 3);
    var msg;
    if (pen === 0) msg = 'Under binary grading the model answers everything, so every question it would get wrong becomes a stated wrong answer (<b>' + G.pct(R.wrong) + '</b>). Abstaining can never score better, so grading gives no reason to stop. ';
    else msg = 'With wrong answers costing ' + pen + ', answering only pays above ' + G.pct(R.t) + ' confidence. ' +
      (s > 0.3 ? 'But the model\'s confidence is inflated (ECE ' + G.fmt(R.ece, 3) + '), so it rarely thinks it is below the line: it abstains on ' + G.pct(R.idk) + ' of questions where a calibrated model would abstain on ' + G.pct(R0.idk) + ', and scores ' + G.fmt(R.score, 3) + ' against ' + G.fmt(R0.score, 3) + '. ' : 'With honest confidence it abstains on ' + G.pct(R.idk) + ' of questions and keeps confident errors to ' + G.pct(R.wrong) + '. ');
    msg += pen === 0 ? 'Change the grading rule to see abstention appear, then raise the pressure to watch overconfidence cancel it.' : 'Both fixes are needed: grading that rewards abstention and confidence that is honest.';
    out.innerHTML = msg;
  }
  G.on(ss, 'input', draw); G.on(gs, 'change', draw);
  return draw;
});
