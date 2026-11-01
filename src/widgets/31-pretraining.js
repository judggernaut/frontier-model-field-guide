G.widget('w-pt-softmax', function (root) {
  var toks = ['mat', 'floor', 'sofa', 'bed', 'roof', 'table', 'dog', 'volcano'];
  var logits = [3.1, 2.4, 1.6, 1.2, 0.3, 0.1, -0.6, -2.2];
  var temp = G.$(root, '#pt-temp'), tempO = G.$(root, '#pt-temp-o'), sel = G.$(root, '#pt-true'), cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  toks.forEach(function (t, i) { var o = document.createElement('option'); o.value = i; o.textContent = t; sel.appendChild(o); });
  function draw() {
    var P = G.pal(), tau = parseFloat(temp.value), k = parseInt(sel.value, 10);
    tempO.textContent = G.fmt(tau, 1);
    var p = G.softmax(logits.map(function (z) { return z / tau; }));
    var p1 = G.softmax(logits);
    var c = G.canvas(cv, 230), ctx = c.ctx, pad = { l: 44, r: 12, t: 14, b: 40 };
    var s = G.axes(ctx, c.w, c.h, pad, { x: [0, toks.length], y: [0, 1], yt: [0, .25, .5, .75, 1], yf: function (v) { return Math.round(v * 100) + '%'; }, yl: 'probability' });
    var bw = (c.w - pad.l - pad.r) / toks.length;
    toks.forEach(function (t, i) {
      var x = pad.l + i * bw + bw * 0.15, w = bw * 0.7;
      ctx.fillStyle = i === k ? P.tp : P.accent; ctx.globalAlpha = i === k ? 1 : 0.45;
      ctx.fillRect(x, s.Y(p[i]), w, s.Y(0) - s.Y(p[i])); ctx.globalAlpha = 1;
      // training-time (tau=1) marker
      ctx.strokeStyle = P.fg; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, s.Y(p1[i])); ctx.lineTo(x + w, s.Y(p1[i])); ctx.stroke();
      G.text(ctx, t, x + w / 2, c.h - pad.b + 12, i === k ? P.tp : P.muted, 'center', 12);
      G.text(ctx, G.pct(p[i]), x + w / 2, s.Y(p[i]) - 8, P.muted, 'center', 11);
    });
    var pk = p[k], ce = -Math.log(pk), H = 0;
    p.forEach(function (q) { if (q > 0) H -= q * Math.log2(q); });
    G.$(root, '[data-p]').textContent = G.pct(pk, 1);
    G.$(root, '[data-ce]').textContent = G.fmt(ce, 3);
    G.$(root, '[data-bits]').textContent = G.fmt(ce / Math.LN2, 3);
    G.$(root, '[data-ppl]').textContent = G.fmt(Math.exp(ce), 2);
    G.$(root, '[data-h]').textContent = G.fmt(H, 2);
    out.innerHTML = 'Black ticks show the bet at temperature 1, the setting used in training. ' +
      (tau < 1 ? 'Lower temperature sharpens the bet: great when the top token is right, very costly when it is wrong.' :
       tau > 1 ? 'Higher temperature flattens the bet toward uniform. Unlikely tokens get more chance, likely ones less.' :
       'Temperature 1 is the distribution the model actually learned.') +
      ' If "volcano" were the true token, the loss would be ' + G.fmt(-Math.log(p[7]), 2) + ' nats at this temperature.';
  }
  G.on([temp, sel], 'input', draw); G.on(sel, 'change', draw);
  return draw;
});

G.widget('w-pt-bpe', function (root) {
  var CORPUS = [['low', 5], ['lower', 2], ['lowest', 2], ['newer', 6], ['newest', 4], ['wider', 3], ['widest', 2], ['new', 3]];
  var words, merges, start = (function () { var a = 0, b = 0; CORPUS.forEach(function (w) { a += (w[0].length + 1) * w[1]; b += w[1]; }); return a / b; })();
  function reset() { words = CORPUS.map(function (w) { return { syms: w[0].split('').concat(['_']), c: w[1] }; }); merges = []; }
  function step() {
    var counts = {}, best = null, bestC = 0;
    words.forEach(function (w) { for (var i = 0; i < w.syms.length - 1; i++) { var k = w.syms[i] + '\u0001' + w.syms[i + 1]; counts[k] = (counts[k] || 0) + w.c; } });
    Object.keys(counts).forEach(function (k) { if (counts[k] > bestC) { bestC = counts[k]; best = k; } });
    if (!best) return false;
    var ab = best.split('\u0001');
    words.forEach(function (w) {
      var o = [], i = 0;
      while (i < w.syms.length) { if (i < w.syms.length - 1 && w.syms[i] === ab[0] && w.syms[i + 1] === ab[1]) { o.push(ab[0] + ab[1]); i += 2; } else { o.push(w.syms[i]); i++; } }
      w.syms = o;
    });
    merges.push([ab[0], ab[1], bestC]); return true;
  }
  function render() {
    var wbox = G.$(root, '[data-words]'), mbox = G.$(root, '[data-merges]');
    wbox.innerHTML = words.map(function (w) {
      return w.syms.map(function (s) { return '<span style="display:inline-block;padding:0 5px;margin:0 2px;border-radius:4px;background:var(--accent-soft);color:var(--accent)">' + s.replace('_', '·') + '</span>'; }).join('') + ' <span style="color:var(--faint)">× ' + w.c + '</span>';
    }).join('<br>');
    mbox.innerHTML = merges.length ? merges.map(function (m) { return '<li>' + m[0].replace('_', '·') + ' + ' + m[1].replace('_', '·') + ' → ' + (m[0] + m[1]).replace('_', '·') + ' <span style="color:var(--faint)">(' + m[2] + ')</span></li>'; }).join('') : '<li style="color:var(--faint);list-style:none">none yet</li>';
    var tot = 0, cnt = 0; words.forEach(function (w) { tot += w.syms.length * w.c; cnt += w.c; });
    var vocab = {}; words.forEach(function (w) { w.syms.forEach(function (s) { vocab[s] = 1; }); });
    G.$(root, '[data-out]').innerHTML = merges.length + ' merges. Average tokens per word: <b>' + G.fmt(tot / cnt, 2) + '</b> (started at ' + G.fmt(start, 2) + '). Symbols in use: ' + Object.keys(vocab).length + '. The "·" marks end of word, so "est·" can only match at the end. Frequent suffixes like "er·" and "est·" become tokens first.';
  }
  reset(); for (var i = 0; i < 3; i++) step();
  G.on(G.$(root, '[data-next]'), 'click', function () { step(); render(); });
  G.on(G.$(root, '[data-all]'), 'click', function () { for (var i = 0; i < 10; i++) step(); render(); });
  G.on(G.$(root, '[data-reset]'), 'click', function () { reset(); render(); });
  return render;
});
