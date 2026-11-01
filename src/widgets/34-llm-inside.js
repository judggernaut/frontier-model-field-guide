/* Chapter 34: Inside an LLM. Two widgets: an illustrative attention heatmap and a tiny trigram next-token predictor. */

G.widget('w-li-attn', function (root) {
  var WORDS = ['The', 'cat', 'sat', 'on', 'the', 'mat', 'because', 'it', 'was', 'tired'];
  var n = WORDS.length, sel = 7;
  var hs = G.$(root, '#li-attn-h'), box = G.$(root, '[data-words]'), cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');

  // Hand-built logits (illustrative). Row i = query position, column j = key position (j <= i).
  function headLogits(h) {
    var L = [];
    for (var i = 0; i < n; i++) {
      var row = [];
      for (var j = 0; j <= i; j++) row.push(0);
      if (h === 0) {
        row[i] += 0.8;
        var links = {
          1: { 0: 1.0 }, 2: { 1: 2.5 }, 3: { 2: 2.0 }, 4: { 3: 1.2 }, 5: { 4: 1.0, 3: 1.6, 2: 1.0 },
          6: { 2: 1.8, 1: 1.2 }, 8: { 7: 2.6, 1: 1.8 }, 9: { 7: 2.0, 1: 2.4, 8: 1.0 }
        };
        if (i === 7) row = [0.2, 3.0, 0.4, 0.1, 0.2, 1.6, 0.5, 1.0]; // same numbers as the story above
        else if (links[i]) for (var k in links[i]) row[+k] += links[i][k];
      } else if (h === 1) {
        for (j = 0; j <= i; j++) row[j] = j === i - 1 ? 4 : (j === i ? 1 : 0);
      } else {
        for (j = 0; j <= i; j++) row[j] = j === 0 ? 3 : (j === i ? 1 : 0.3);
      }
      L.push(row);
    }
    return L;
  }
  function weights(h) { return headLogits(h).map(function (r) { return G.softmax(r); }); }

  var btns = WORDS.map(function (w, i) {
    var b = document.createElement('button');
    b.className = 'b'; b.textContent = w; b.setAttribute('aria-pressed', i === sel ? 'true' : 'false');
    b.addEventListener('click', function () { sel = i; draw(); });
    box.appendChild(b); return b;
  });

  var geom = null;
  function draw() {
    var P = G.pal(), h = +hs.value, W = weights(h);
    btns.forEach(function (b, i) { b.setAttribute('aria-pressed', i === sel ? 'true' : 'false'); });
    var wide = (cv.parentElement.clientWidth || 640) >= 620;
    var c = G.canvas(cv, wide ? 356 : 690), ctx = c.ctx;

    // Panel 1: the full causal matrix.
    var labW = 62, top = 70, size = Math.min(26, Math.floor(((wide ? c.w * 0.5 : c.w) - labW - 16) / n));
    var mx = 8 + labW, my = top;
    G.text(ctx, 'all rows (query → keys)', 8, 14, P.muted, 'left', 12);
    for (var j = 0; j < n; j++) {
      ctx.save(); ctx.translate(mx + j * size + size / 2, my - 6); ctx.rotate(-Math.PI / 4);
      G.text(ctx, WORDS[j], 0, 0, j === sel ? P.fg : P.muted, 'left', 12); ctx.restore();
    }
    for (var i = 0; i < n; i++) {
      G.text(ctx, WORDS[i], mx - 6, my + i * size + size / 2, i === sel ? P.fg : P.muted, 'right', 12);
      for (j = 0; j < n; j++) {
        var x = mx + j * size, y = my + i * size;
        if (j > i) { G.dot(ctx, x + size / 2, y + size / 2, 1.6, P.faint); continue; }
        ctx.fillStyle = P.surface; ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
        ctx.globalAlpha = 0.12 + 0.88 * W[i][j]; ctx.fillStyle = P.accent; ctx.fillRect(x + 1, y + 1, size - 2, size - 2); ctx.globalAlpha = 1;
      }
    }
    ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.strokeRect(mx, my + sel * size, (sel + 1) * size, size);
    G.text(ctx, 'dots = masked (future positions)', mx, my + n * size + 14, P.faint, 'left', 11);
    geom = { mx: mx, my: my, size: size };

    // Panel 2: bars for the selected query.
    var bx = wide ? c.w * 0.5 + 70 : 70, by = wide ? 40 : my + n * size + 60, bw = (wide ? c.w * 0.5 : c.w) - 70 - 60;
    G.text(ctx, '"' + WORDS[sel] + '" attends to:', bx - 62, by - 18, P.fg, 'left', 13);
    var rowH = Math.min(26, (wide ? 280 : 260) / n);
    for (j = 0; j <= sel; j++) {
      var yy = by + j * rowH, v = W[sel][j];
      G.text(ctx, WORDS[j], bx - 8, yy + rowH / 2, P.muted, 'right', 12);
      ctx.fillStyle = P.sunk; ctx.fillRect(bx, yy + 4, bw, rowH - 8);
      ctx.fillStyle = P.accent; ctx.fillRect(bx, yy + 4, Math.max(1, bw * v), rowH - 8);
      G.text(ctx, G.pct(v), bx + Math.max(1, bw * v) + 6, yy + rowH / 2, P.fg, 'left', 12);
    }
    for (j = sel + 1; j < n; j++) {
      G.text(ctx, WORDS[j], bx - 8, by + j * rowH + rowH / 2, P.faint, 'right', 12);
      G.text(ctx, 'masked: not written yet', bx, by + j * rowH + rowH / 2, P.faint, 'left', 12);
    }

    // Readout.
    var order = W[sel].map(function (v, k) { return [v, k]; }).sort(function (a, b) { return b[0] - a[0]; });
    var top1 = order[0], top2 = order[1];
    var msg = '<b>"' + WORDS[sel] + '"</b> puts <b>' + G.pct(top1[0]) + '</b> of its attention on "' + WORDS[top1[1]] + '"' +
      (top2 ? ' and ' + G.pct(top2[0]) + ' on "' + WORDS[top2[1]] + '"' : '') + '. ';
    if (sel === 0) msg += 'The first token can only see itself, so its whole row is one cell. ';
    var why = [
      'Head A links words by meaning: "it" finds "cat", "sat" finds who sat, "tired" looks back at "it" and "cat". Note that "it" cannot use "tired" to decide, because "tired" comes later.',
      'Head B copies the previous word. Heads like this are common and feed into "induction heads" that complete repeated patterns.',
      'Head C parks most of its weight on the first token when nothing else is relevant. Researchers call this an attention sink; it acts as a "no-op" option.'
    ][h];
    out.innerHTML = msg + why + ' Every row adds up to 100%, and everything to the right of the diagonal is masked.';
  }
  cv.addEventListener('click', function (e) {
    if (!geom) return;
    var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    var i = Math.floor((y - geom.my) / geom.size), j = Math.floor((x - geom.mx) / geom.size);
    if (i >= 0 && i < n && j >= 0 && j < n) { sel = i; draw(); }
  });
  G.on(hs, 'change', draw);
  return draw;
});

G.widget('w-li-ngram', function (root) {
  var CORPUS = [
    'the cat sat on the mat .', 'the cat sat on the sofa .', 'the dog sat on the rug .', 'the dog slept on the floor .',
    'the cat slept on the bed .', 'the cat slept in the sun .', 'the dog ran in the park .', 'the dog ran to the door .',
    'the cat ran up the tree .', 'the bird sat on the roof .', 'the bird sang in the tree .', 'the cat chased the bird .',
    'the dog chased the cat .', 'the cat ate the fish .', 'the dog ate the bone .', 'the cat drank the milk .',
    'the dog is happy .', 'the cat is hungry .', 'the cat is tired .', 'the dog is tired .', 'the sun is warm today .',
    'the rain is cold today .', 'it is sunny today .', 'it is raining today .', 'it was a cold day .', 'it was a long day .',
    'we went to the park .', 'we went to the beach .', 'we went to the shop .', 'i went to the shop to buy milk .',
    'i went to the park with the dog .', 'she went to the beach with her friends .', 'he sat on the bench in the park .',
    'the children played in the park .', 'the children played on the beach .', 'the train was late again .',
    'the bus was late today .', 'the coffee was hot .', 'the tea was cold .', 'i like hot coffee in the morning .',
    'i like cold milk .', 'i like the cat .', 'i like the dog .', 'she likes the cat more than the dog .',
    'he likes the dog more than the cat .', 'the cat looked out of the window .', 'the dog looked at the ball .',
    'the dog played with the ball .', 'the cat played with the string .', 'the model predicts the next word .',
    'the model reads the whole sentence .', 'the model picks one word at a time .', 'a model is a guess machine .',
    'see you at the park .', 'see you at the gym tomorrow .', 'see you at the station .', 'see you tomorrow morning .',
    'good morning .', 'good night .', 'thank you very much .', 'thank you for the coffee .',
    'once upon a time there was a cat .', 'once upon a time there was a dog who liked the park .',
    'the cat was asleep on the sofa .', 'the dog was asleep by the door .', 'the cat is on the table again .',
    'the weather was warm and sunny .', 'the weather was cold and wet .'
  ];
  function tok(s) { return s.toLowerCase().replace(/([.,!?])/g, ' $1 ').split(/\s+/).filter(Boolean); }
  var stream = [];
  CORPUS.forEach(function (s) { stream = stream.concat(tok(s)); });
  var uni = {}, bi = {}, tri = {};
  function inc(m, k, w) { (m[k] = m[k] || {}); m[k][w] = (m[k][w] || 0) + 1; }
  stream.forEach(function (w, i) {
    uni[w] = (uni[w] || 0) + 1;
    if (i >= 1) inc(bi, stream[i - 1], w);
    if (i >= 2) inc(tri, stream[i - 2] + ' ' + stream[i - 1], w);
  });

  var ip = G.$(root, '#li-ng-p'), ms = G.$(root, '#li-ng-m'), ts = G.$(root, '#li-ng-t'), to = G.$(root, '#li-ng-t-o');
  var bN = G.$(root, '[data-next]'), bG = G.$(root, '[data-gen]'), bR = G.$(root, '[data-reset]');
  var txt = G.$(root, '[data-text]'), cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var gen = [], last = null, rng = G.rng(1), timer = null;

  function context() { return tok(ip.value).concat(gen); }
  function dist(ctxT, T) {
    var a = ctxT[ctxT.length - 2], b = ctxT[ctxT.length - 1], counts, used, how;
    if (a && b && tri[a + ' ' + b]) { counts = tri[a + ' ' + b]; used = a + ' ' + b; how = 'the last two words'; }
    else if (b && bi[b]) { counts = bi[b]; used = b; how = 'only the last word (the two-word context was never seen)'; }
    else { counts = uni; used = ''; how = 'no context at all (unseen words), just overall word frequency'; }
    var ws = Object.keys(counts), tot = 0;
    var raw = ws.map(function (w) { return counts[w]; });
    var sumRaw = G.sum(raw);
    var p = raw.map(function (c) { var v = Math.pow(c, 1 / T); tot += v; return v; }).map(function (v) { return v / tot; });
    var items = ws.map(function (w, i) { return { w: w, p: p[i], c: raw[i] }; });
    items.sort(function (x, y) { return y.p - x.p || (x.w < y.w ? -1 : 1); });
    return { items: items, used: used, how: how, n: sumRaw };
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function step() {
    var d = dist(context(), +ts.value), pick;
    if (ms.value === 'g') pick = d.items[0];
    else {
      var r = rng(), acc = 0; pick = d.items[d.items.length - 1];
      for (var i = 0; i < d.items.length; i++) { acc += d.items[i].p; if (r < acc) { pick = d.items[i]; break; } }
    }
    gen.push(pick.w); last = pick;
    draw();
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } bN.disabled = bG.disabled = false; }
  function reset() { stop(); gen = []; last = null; rng = G.rng(1); draw(); }

  function draw() {
    var P = G.pal(), T = +ts.value;
    to.textContent = G.fmt(T, 2);
    var pr = tok(ip.value);
    txt.innerHTML = pr.map(esc).join(' ') + (gen.length ? ' ' : '') + gen.map(function (w, i) {
      return '<span style="color:var(--accent);font-weight:600;' + (i === gen.length - 1 ? 'background:var(--accent-soft);border-radius:4px;padding:0 3px' : '') + '">' + esc(w) + '</span>';
    }).join(' ');
    var d = dist(context(), T), k = d.items.length === 9 ? 9 : 8, top = d.items.slice(0, k), rest = d.items.slice(k);
    var restP = G.sum(rest.map(function (x) { return x.p; }));
    var rows = top.map(function (x) { return [x.w, x.p]; });
    if (rest.length) rows.push(['(' + rest.length + ' others)', restP]);
    var c = G.canvas(cv, 30 + rows.length * 26), ctx = c.ctx, lx = 120, bw = c.w - lx - 70;
    G.text(ctx, 'next-token probabilities at temperature ' + G.fmt(T, 2), 8, 12, P.muted, 'left', 12);
    rows.forEach(function (r, i) {
      var y = 26 + i * 26, isRest = i === top.length;
      G.text(ctx, r[0] === '.' ? '. (end)' : r[0], lx - 8, y + 11, isRest ? P.faint : P.fg, 'right', 13);
      ctx.fillStyle = P.sunk; ctx.fillRect(lx, y + 2, bw, 18);
      ctx.fillStyle = isRest ? P.tn : (i === 0 ? P.accent : P.accentSoft); ctx.fillRect(lx, y + 2, Math.max(1, bw * r[1]), 18);
      if (!isRest && i !== 0) { ctx.strokeStyle = P.accent; ctx.lineWidth = 1; ctx.strokeRect(lx + .5, y + 2.5, Math.max(1, bw * r[1]) - 1, 17); }
      G.text(ctx, G.pct(r[1], 1), lx + bw * r[1] + 6, y + 11, P.muted, 'left', 12);
    });
    var unk = pr.filter(function (w) { return !uni[w]; });
    var s = 'Context used: <b>' + (d.used ? '"' + esc(d.used) + '"' : 'none') + '</b>, ' + d.how + '. ' +
      'That context was followed by ' + d.items.length + ' different tokens in ' + d.n + ' occurrences in the corpus. ';
    if (last) s += 'Last pick: <b>"' + esc(last.w) + '"</b> (' + G.pct(last.p, 1) + ', ' + (ms.value === 'g' ? 'greedy' : 'sampled') + '). ';
    if (unk.length) s += 'Never seen in the corpus: ' + unk.map(function (w) { return '"' + esc(w) + '"'; }).join(', ') + '. ';
    if (ms.value === 'g' && gen.length >= 6) s += 'Greedy decoding with two words of context tends to fall into loops.';
    else if (!gen.length) s += 'A real LLM produces exactly this kind of list, over about 100,000 tokens, using the whole context instead of two words.';
    out.innerHTML = s;
  }
  bN.addEventListener('click', function () { stop(); step(); });
  bG.addEventListener('click', function () {
    stop(); var k = 0; bN.disabled = bG.disabled = true;
    timer = setInterval(function () { step(); if (++k >= 12) stop(); }, 320);
  });
  bR.addEventListener('click', reset);
  G.on(ip, 'input', reset);
  G.on(ms, 'change', reset);
  G.on(ts, 'input', draw);
  return draw;
});
