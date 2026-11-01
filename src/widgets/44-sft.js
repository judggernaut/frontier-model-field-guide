/* Chapter 34: SFT widgets */
G.widget('w-sf-mask', function (root) {
  var turns = [
    { role: 'system', text: 'You are a helpful travel assistant.' },
    { role: 'user', text: "What's the weather in Lisbon tomorrow?" },
    { role: 'assistant', text: 'get_weather(city="Lisbon")', call: true },
    { role: 'tool', text: '{"high": 22, "low": 15, "rain": 0.1}' },
    { role: 'assistant', text: 'Tomorrow in Lisbon: high 22°C, low 15°C, small chance of rain.' },
    { role: 'user', text: 'Should I pack a jacket?' },
    { role: 'assistant', text: 'Yes, a light jacket for the evening.' }
  ];
  var lastAsst = 6;
  var scheme = 'asst';
  var notes = {
    all: 'Every token is a target, including the system prompt, user questions, and the tool result. The model learns to write user turns and to invent tool output. Rarely what you want.',
    naive: 'A common bug: the pipeline stores tool results inside the assistant role, so they get trained. The model learns to make up weather data instead of waiting for the tool.',
    asst: 'The usual default. Every assistant turn, including the tool call and its end-of-turn marker, is a target. Context tokens shape attention but add nothing to the loss.',
    last: 'Only the final answer teaches. Simple, but most assistant tokens in a multi-turn example are thrown away, including the tool call the model needs to learn.'
  };
  var box = G.$(root, '[data-tokens]'), btns = G.$$(root, 'button[data-scheme]');
  btns[0].dataset.scheme = 'all'; btns[0].textContent = 'Train on everything';
  btns[1].dataset.scheme = 'naive'; btns[1].textContent = 'Assistant role, tool output folded in';
  btns[2].dataset.scheme = 'asst'; btns[2].textContent = 'Assistant turns only (default)';
  btns[3].dataset.scheme = 'last'; btns[3].textContent = 'Final assistant turn only';
  function toks(t) { return t.match(/[A-Za-z]+|\d+|[^\sA-Za-z\d]/g) || []; }
  function trained(i, role) {
    if (scheme === 'all') return true;
    if (scheme === 'naive') return role === 'assistant' || role === 'tool';
    if (scheme === 'asst') return role === 'assistant';
    if (scheme === 'last') return i === lastAsst;
    return false;
  }
  function chip(t, on, bad) {
    var bg = on ? (bad ? 'var(--warn-soft)' : 'var(--accent-soft)') : 'var(--sunk)';
    var bd = on ? (bad ? 'var(--warn)' : 'var(--accent)') : 'var(--line)';
    var fg = on ? (bad ? 'var(--warn)' : 'var(--accent)') : 'var(--faint)';
    return '<span style="display:inline-block;font-variant-ligatures:none;font-family:var(--font-mono);font-size:12px;padding:1px 5px;margin:1px;border-radius:4px;border:1px solid ' + bd + ';background:' + bg + ';color:' + fg + '">' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
  }
  function draw() {
    var tot = 0, inl = 0, html = '';
    turns.forEach(function (tr, i) {
      var on = trained(i, tr.role), bad = on && tr.role !== 'assistant';
      var tk = ['<|im_start|>' + tr.role].concat(toks(tr.text)).concat(['<|im_end|>']);
      var row = '';
      tk.forEach(function (t, j) {
        // the role header is a prompt for the model, so it is never a target even in assistant turns; the end marker is
        var isHeader = j === 0;
        var tOn = on && !(isHeader && scheme !== 'all');
        tot++; if (tOn) inl++;
        row += chip(t, tOn, bad);
      });
      html += '<div style="display:grid;grid-template-columns:72px minmax(0,1fr);gap:8px;align-items:start"><span style="font-family:var(--font-mono);font-size:11px;color:var(--muted);padding-top:4px;text-transform:uppercase;letter-spacing:.05em">' + tr.role + '</span><div>' + row + '</div></div>';
    });
    box.innerHTML = html;
    G.$(root, '[data-tot]').textContent = tot;
    G.$(root, '[data-in]').textContent = inl;
    G.$(root, '[data-share]').textContent = G.pct(inl / tot);
    G.$(root, '[data-out]').innerHTML = notes[scheme] + ' <span class="muted">Words stand in for tokens here; real tokenizers split differently. Orange marks tokens that are trained but should not be.</span>';
    btns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.scheme === scheme ? 'true' : 'false'); });
  }
  btns.forEach(function (b) { b.addEventListener('click', function () { scheme = b.dataset.scheme; draw(); }); });
  return draw;
});

G.widget('w-sf-curves', function (root) {
  var sn = G.$(root, '#sf-n'), sd = G.$(root, '#sf-d'), sl = G.$(root, '#sf-lr'), cv = G.$(root, 'canvas');
  function model(N, d, lr) {
    var mem = Math.min(0.6, Math.max(0.03, 0.25 * Math.pow(14000 / N, 0.5)));
    var of = 0.012 * (mem / 0.25) * (1.4 - d) * lr;
    var base = 0.6 + 0.12 * (1 - d);
    var forget = 14 * (1 - d * 0.85) * Math.pow(lr, 0.8) * (0.6 + mem);
    return {
      tr: function (e) { return 0.55 + 0.85 * Math.exp(-2 * lr * e) - mem * (1 - Math.exp(-0.5 * lr * e)); },
      va: function (e) { return base + 0.85 * Math.exp(-2 * lr * e) + of * e * e; },
      be: function (e) { return 62 + 3 * (1 - Math.exp(-3 * e)) - forget * (1 - Math.exp(-0.25 * e)); }
    };
  }
  function draw() {
    var P = G.pal();
    var N = Math.round(1000 * Math.pow(200, sn.value / 100)), d = +sd.value, lr = +sl.value;
    G.$(root, '#sf-n-o').textContent = G.big(N); G.$(root, '#sf-d-o').textContent = G.fmt(d, 2); G.$(root, '#sf-lr-o').textContent = G.fmt(lr, 2) + '×';
    var m = model(N, d, lr);
    var c = G.canvas(cv, 260), ctx = c.ctx, pad = { l: 46, r: 48, t: 14, b: 36 };
    var s = G.axes(ctx, c.w, c.h, pad, { x: [0, 8], y: [0, 1.6], xt: [0, 1, 2, 3, 4, 5, 6, 7, 8], yt: [0, 0.4, 0.8, 1.2, 1.6], yf: function (v) { return G.fmt(v, 1); }, xl: 'epochs', yl: 'loss' });
    var BY = function (v) { return c.h - pad.b - (v - 40) / (70 - 40) * (c.h - pad.t - pad.b); };
    [40, 50, 60, 70].forEach(function (v) { G.text(ctx, v + '%', c.w - pad.r + 6, BY(v), P.tp, 'left', 11); });
    var tr = [], va = [], be = [], best = 0, bestV = 1e9;
    for (var i = 0; i <= 160; i++) {
      var e = i / 20;
      var v = m.va(e);
      if (e >= 0.25 && v < bestV) { bestV = v; best = e; }
      tr.push([s.X(e), s.Y(Math.max(0, m.tr(e)))]); va.push([s.X(e), s.Y(Math.min(1.6, v))]);
      be.push([s.X(e), BY(Math.max(40, Math.min(70, m.be(e))))]);
    }
    G.line(ctx, tr, P.accent, 2); G.line(ctx, va, P.fp, 2); G.line(ctx, be, P.tp, 2, [6, 4]);
    ctx.save(); ctx.strokeStyle = P.faint; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(s.X(best), pad.t); ctx.lineTo(s.X(best), c.h - pad.b); ctx.stroke(); ctx.restore();
    G.dot(ctx, s.X(best), s.Y(bestV), 5, P.fp, P.surface);
    var bb = m.be(best), be8 = m.be(8);
    G.$(root, '[data-best]').textContent = G.fmt(best, 1);
    G.$(root, '[data-bench]').textContent = G.fmt(bb, 1) + '%';
    G.$(root, '[data-end]').textContent = G.fmt(be8, 1) + '%';
    var msg;
    if (best < 1.6 && bb < 62) msg = 'Small, narrow data overfits almost immediately and the general benchmark falls below the base model\'s 62%. Add diverse data, replay general instructions, or switch to LoRA.';
    else if (best < 2.5) msg = 'Validation loss bottoms out around epoch ' + G.fmt(best, 1) + '. Training longer keeps lowering train loss while validation rises: the model is memorising examples.';
    else msg = 'With this much diverse data the model can train for several epochs before validation loss turns up.';
    if (be8 < bb - 3) msg += ' Running all 8 epochs would cost ' + G.fmt(bb - be8, 1) + ' points of general capability compared with stopping early.';
    G.$(root, '[data-out]').textContent = msg + ' The base model scores 62% on the general benchmark before SFT.';
  }
  G.on([sn, sd, sl], 'input', draw);
  return draw;
});
