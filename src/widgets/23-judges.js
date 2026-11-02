/* Chapter 23: a yes/no judge is one ROC point; prompt wording slides it; logprob scores restore the curve. */
G.widget('w-jd-roc', function (root) {
  var M = { l: 44, t: 10, w: 244, h: 230 };
  function PX(v) { return M.l + v * M.w; } function PY(v) { return M.t + (1 - v) * M.h; }
  var K = 15.3; function f(x) { return 1 - Math.pow(1 - x, K); }
  function pc(v) { return Math.round(v * 100) + '%'; }
  function axes() {
    var r = '<rect x="' + M.l + '" y="' + M.t + '" width="' + M.w + '" height="' + M.h + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
    [0, 0.5, 1].forEach(function (v) {
      r += '<text x="' + PX(v) + '" y="' + (M.t + M.h + 15) + '" text-anchor="middle" font-size="11" fill="var(--faint)">' + pc(v) + '</text>' +
        '<text x="' + (M.l - 7) + '" y="' + (PY(v) + 4) + '" text-anchor="end" font-size="11" fill="var(--faint)">' + pc(v) + '</text>';
    });
    r += '<text x="' + (M.l + M.w / 2) + '" y="281" text-anchor="middle" font-size="12" fill="var(--muted)">Good items wrongly flagged</text>' +
      '<text x="13" y="' + (M.t + M.h / 2) + '" text-anchor="middle" font-size="12" fill="var(--muted)" transform="rotate(-90 13 ' + (M.t + M.h / 2) + ')">Bad items caught</text>';
    r += '<line x1="' + PX(0) + '" y1="' + PY(0) + '" x2="' + PX(1) + '" y2="' + PY(1) + '" stroke="var(--faint)" stroke-dasharray="3 3" stroke-width="1"/>';
    return r;
  }
  function dot(x, y, lab, c, big, dy) { return '<circle cx="' + PX(x) + '" cy="' + PY(y) + '" r="' + (big ? 7 : 6) + '" fill="' + c + '" stroke="var(--surface)" stroke-width="2"/><text x="' + (PX(x) + 10) + '" y="' + (PY(y) + (dy || 15)) + '" font-size="11" fill="var(--muted)">' + lab + '</text>'; }
  function card(l, v, cls) { return '<div class="mc ' + (cls || '') + '" style="margin-bottom:10px"><div class="l">' + l + '</div><div class="v">' + v + '</div></div>'; }
  function curve() { var d = ''; for (var i = 0; i <= 200; i++) { var x = i / 200; d += (i ? 'L' : 'M') + PX(x).toFixed(1) + ',' + PY(f(x)).toFixed(1); } return d; }
  var svg = G.$(root, 'svg'), side = G.$(root, '[data-side]'), mode = 'a';
  var modes = {
    a: function () {
      svg.innerHTML = axes() + '<path d="M' + PX(0) + ',' + PY(0) + ' L' + PX(0.1) + ',' + PY(0.8) + ' L' + PX(1) + ',' + PY(1) + ' L' + PX(1) + ',' + PY(0) + ' Z" fill="var(--roc)" fill-opacity="0.2"/><path d="M' + PX(0) + ',' + PY(0) + ' L' + PX(0.1) + ',' + PY(0.8) + ' L' + PX(1) + ',' + PY(1) + '" fill="none" stroke="var(--roc)" stroke-width="1.5" stroke-dasharray="5 3"/>' + dot(0.1, 0.8, 'Your judge', 'var(--fg)', 1);
      side.innerHTML = card('Bad items caught', '80%') + card('Good items flagged', '10%') + card('"AUC" from one dot', '0.85', 'roc');
    },
    b: function () {
      svg.innerHTML = axes() + '<path d="' + curve() + '" fill="none" stroke="var(--faint)" stroke-width="1.5"/>' + dot(0.03, f(0.03), 'Strict prompt', 'var(--roc)', 0, 18) + dot(0.1, 0.8, 'Neutral prompt', 'var(--roc)') + dot(0.3, f(0.3), 'Lenient prompt', 'var(--roc)') + dot(0.04, 0.86, 'Better prompt', 'var(--tp)', 1, -8);
      side.innerHTML = '<p class="small muted" style="margin:0">Purple dots slide along the same curve. That is a trade-off, not an improvement.</p><p class="small muted"><b style="color:var(--tp)">The green dot</b> sits above the curve. It caught more and flagged fewer good items, so it is genuinely better.</p>';
    },
    c: function () {
      var d = curve();
      svg.innerHTML = axes() + '<path d="' + d + ' L' + PX(1) + ',' + PY(0) + ' L' + PX(0) + ',' + PY(0) + ' Z" fill="var(--roc)" fill-opacity="0.2"/><path d="' + d + '" fill="none" stroke="var(--roc)" stroke-width="2"/>' + dot(0.1, 0.8, 'Plain yes/no answer', 'var(--fg)', 1);
      side.innerHTML = card('Thresholds available', 'All of them') + card('AUC', '0.94', 'roc');
    }
  };
  var btns = G.$$(root, '[data-mode]');
  btns.forEach(function (b) {
    G.on(b, 'click', function () {
      mode = b.dataset.mode;
      btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      modes[mode]();
    });
  });
  return function () { modes[mode](); };
});

/* Chapter 23: raw agreement versus Cohen's kappa. The three sliders fix the 2x2 table:
   TP = (po - 1 + h + j) / 2, FP = j - TP, FN = h - TP, TN = 1 - h - j + TP. */
G.widget('w-jd-kappa', function (root) {
  var sh = G.$(root, '#jd-kp-h'), sj = G.$(root, '#jd-kp-j'), so = G.$(root, '#jd-kp-o');
  var oh = G.$(root, '#jd-kp-h-o'), oj = G.$(root, '#jd-kp-j-o'), oo = G.$(root, '#jd-kp-o-o');
  var cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]'), N = 200;
  var k = function (n) { return G.$(root, '[data-k=' + n + ']'); };
  var cell = function (n) { return G.$(root, '[data-c=' + n + ']'); };
  var presets = { lazy: [0.85, 1, 0.85], worked: [0.5, 0.61, 0.79], good: [0.85, 0.83, 0.94] };
  var btns = G.$$(root, 'button[data-preset]');
  function press(name) { btns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.preset === name ? 'true' : 'false'); }); }
  btns.forEach(function (b) {
    G.on(b, 'click', function () { var v = presets[b.dataset.preset]; sh.value = v[0]; sj.value = v[1]; so.value = v[2]; press(b.dataset.preset); draw(); });
  });
  function r2(x) { return Math.round(x * 100) / 100; }
  function label(kap) {   // Landis and Koch (1977) descriptive bands
    if (kap < 0) return 'worse than luck';
    if (kap <= 0.2) return 'slight';
    if (kap <= 0.4) return 'fair';
    if (kap <= 0.6) return 'moderate';
    if (kap <= 0.8) return 'substantial';
    return 'almost perfect';
  }
  function draw(ev) {
    if (ev && ev.type === 'input') press('');
    var h = r2(+sh.value), j = r2(+sj.value);
    var lo = r2(Math.abs(1 - h - j)), hi = r2(1 - Math.abs(h - j));
    var po = Math.min(hi, Math.max(lo, r2(+so.value)));
    so.value = po;
    oh.textContent = G.pct(h); oj.textContent = G.pct(j); oo.textContent = G.pct(po);
    var tp = (po - 1 + h + j) / 2, fp = j - tp, fn = h - tp, tn = 1 - h - j + tp;
    var pe = h * j + (1 - h) * (1 - j), kap = (po - pe) / (1 - pe);
    var E = { tp: h * j, fp: (1 - h) * j, fn: h * (1 - j), tn: (1 - h) * (1 - j) }, A = { tp: tp, fp: fp, fn: fn, tn: tn };
    ['tp', 'fp', 'fn', 'tn'].forEach(function (c) {
      var el = cell(c); el.style.setProperty('--c', 'var(--' + c + ')');
      el.innerHTML = '<b>' + G.fmt(A[c] * N, 0) + '</b><span>luck: ' + G.fmt(E[c] * N, 0) + '</span>';
    });

    /* the agreement ruler: luck fills 0..pe, kappa is the share of the room above luck that the judge covers */
    var P = G.pal(), c = G.canvas(cv, 226), ctx = c.ctx, L = 14, R = 14, W = c.w - L - R;
    var X = function (v) { return L + v * W; };
    G.text(ctx, 'Agreement, 0% to 100%', L, 10, P.muted, 'left', 12);
    var y1 = 40, bh = 26;
    ctx.fillStyle = P.sunk; ctx.fillRect(X(0), y1, W, bh);
    ctx.fillStyle = P.tn; ctx.globalAlpha = 0.45; ctx.fillRect(X(0), y1, X(pe) - X(0), bh); ctx.globalAlpha = 1;
    if (po >= pe) { ctx.fillStyle = P.accent; ctx.fillRect(X(pe), y1, X(po) - X(pe), bh); }
    else { ctx.fillStyle = P.fp; ctx.globalAlpha = 0.8; ctx.fillRect(X(po), y1, X(pe) - X(po), bh); ctx.globalAlpha = 1; }
    function clampX(x, half) { return Math.min(c.w - R - half, Math.max(L + half, x)); }
    if (X(pe) - X(0) > 96) G.text(ctx, 'luck ' + G.pct(pe, 1), X(pe) - 6, y1 + bh / 2, P.fg, 'right', 11.5);
    // observed agreement marker, labelled above the bar
    ctx.strokeStyle = P.fg; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(po), y1 - 5); ctx.lineTo(X(po), y1 + bh + 3); ctx.stroke();
    G.text(ctx, 'observed ' + G.pct(po), clampX(X(po), 46), y1 - 13, P.fg, 'center', 11.5);
    [0, 0.25, 0.5, 0.75, 1].forEach(function (t) { G.text(ctx, G.pct(t), clampX(X(t), 12), y1 + bh + 11, P.faint, 'center', 10.5); });
    // feasible range for raw agreement, given the two pass rates
    var fy = y1 + bh + 28;
    ctx.strokeStyle = P.faint; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(lo), fy); ctx.lineTo(X(hi), fy); ctx.stroke(); ctx.setLineDash([]);
    [lo, hi].forEach(function (v) { ctx.beginPath(); ctx.moveTo(X(v), fy - 4); ctx.lineTo(X(v), fy + 4); ctx.stroke(); });
    var feas = lo === hi ? 'these pass rates force agreement to ' + G.pct(lo) : 'possible agreement at these pass rates: ' + G.pct(lo) + ' to ' + G.pct(hi);
    var fx = (X(lo) + X(hi)) / 2, fa = 'center', tw = ctx.measureText(feas).width / 2 + 4;
    if (fx - tw < L) { fx = L; fa = 'left'; } else if (fx + tw > c.w - R) { fx = c.w - R; fa = 'right'; }
    G.text(ctx, feas, fx, fy + 13, P.faint, fa, 11);
    // second row: the room above luck, stretched to full width
    var y2 = 146;
    G.text(ctx, 'Room above luck (p_e to 100%), stretched', L, y2 - 16, P.muted, 'left', 12);
    ctx.fillStyle = P.sunk; ctx.fillRect(X(0), y2, W, bh);
    if (kap >= 0) { ctx.fillStyle = P.accent; ctx.fillRect(X(0), y2, W * Math.min(1, kap), bh); }
    else { ctx.fillStyle = P.fp; ctx.globalAlpha = 0.8; ctx.fillRect(X(0), y2, W * Math.min(1, -kap), bh); ctx.globalAlpha = 1; }
    [0.2, 0.4, 0.6, 0.8].forEach(function (t) { ctx.strokeStyle = P.surface; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(t), y2); ctx.lineTo(X(t), y2 + bh); ctx.stroke(); });
    var kt = kap >= 0 ? 'κ = ' + G.fmt(kap, 2) + ': covers ' + G.pct(Math.max(0, kap)) + ' of the room' : 'κ = ' + G.fmt(kap, 2) + ': agrees less than luck would';
    var inside = Math.abs(kap) > 0.55;
    G.text(ctx, kt, inside ? X(0) + 8 : X(Math.min(1, Math.abs(kap))) + 8, y2 + bh / 2, inside ? P.surface : P.fg, 'left', 12);
    var lx = L, ly = y2 + bh + 22;
    [[P.tn, 'luck alone (p_e)', 0.45], [P.accent, 'agreement beyond luck', 1], [P.fp, 'below luck', 0.8]].forEach(function (it) {
      ctx.fillStyle = it[0]; ctx.globalAlpha = it[2]; ctx.fillRect(lx, ly - 5, 10, 10); ctx.globalAlpha = 1;
      G.text(ctx, it[1], lx + 15, ly, P.muted, 'left', 11.5); lx += ctx.measureText(it[1]).width + 34;
      if (lx > c.w - 110) { lx = L; ly += 18; }
    });

    k('po').textContent = G.pct(po); k('pe').textContent = G.pct(pe, 1);
    k('kappa').textContent = G.fmt(kap, 2); k('kappa').style.color = kap < 0.2 ? 'var(--fp)' : kap > 0.6 ? 'var(--tp)' : '';
    var gap = j - h; k('gap').textContent = (gap > 0 ? '+' : '') + G.fmt(gap * 100, 0) + ' pts';
    var s = 'Luck alone: people pass ' + G.pct(h) + ' of items and the judge passes ' + G.pct(j) + ', so two raters who ignored the content would still agree on ' +
      G.fmt(h, 2) + ' × ' + G.fmt(j, 2) + ' + ' + G.fmt(1 - h, 2) + ' × ' + G.fmt(1 - j, 2) + ' = <b>' + G.pct(pe, 1) + '</b> of items. ' +
      'Kappa only credits the agreement above that: (' + G.fmt(po, 2) + ' − ' + G.fmt(pe, 3) + ') / (1 − ' + G.fmt(pe, 3) + ') = <b>' + G.fmt(kap, 2) + '</b>, ' + label(kap) + ' on the Landis and Koch (1977) scale. ';
    if (Math.abs(kap) < 0.005 && j >= 0.995) s += 'This judge never looks at the answer. Its ' + G.pct(po) + ' agreement is exactly the share of items people pass, so it tells you nothing about which ones deserve to pass.';
    else if (Math.abs(kap) < 0.05) s += 'The judge agrees about as often as a coin weighted to its pass rate would. The raw ' + G.pct(po) + ' is almost all luck.';
    else if (kap < 0) s += 'The judge is systematically wrong: it agrees less often than random labelling at the same rates.';
    else if (Math.abs(gap) >= 0.05) s += 'It does carry signal, but it passes ' + G.fmt(Math.abs(gap) * 100, 0) + ' points ' + (gap > 0 ? 'more' : 'less') + ' often than people do, so every absolute pass rate it reports is ' + (gap > 0 ? 'inflated' : 'deflated') + ' by about that much.';
    else s += 'It carries real signal and its pass rate is within ' + G.fmt(Math.abs(gap) * 100, 0) + ' points of the human rate, so its absolute numbers are usable too.';
    out.innerHTML = s;
  }
  G.on([sh, sj, so], 'input', draw);
  return draw;
});
