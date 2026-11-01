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
