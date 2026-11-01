/* Shared helpers for every new widget. Exposed as window.G.
   Widgets register with G.widget('w-id', function(root){ ...; return draw; }).
   draw() is called once at start, on resize, and when the theme changes. */
window.G = (function () {
  var reg = [];
  function css(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n); return (v && v.trim()) || f; }
  function pal() {
    return {
      fg: css('--fg', '#16202A'), muted: css('--muted', '#55606C'), faint: css('--faint', '#87919B'),
      line: css('--line', '#D3DAE1'), bg: css('--bg', '#F3F5F8'), surface: css('--surface', '#fff'), sunk: css('--sunk', '#E8ECF1'),
      accent: css('--accent', '#463EAE'), accentSoft: css('--accent-soft', '#E6E5F9'),
      tp: css('--tp', '#14906A'), fp: css('--fp', '#D4552B'), fn: css('--fn', '#B97A18'), tn: css('--tn', '#8A929A'),
      roc: css('--roc', '#5850C8'), pr: css('--pr', '#14906A'),
      eli5: css('--eli5', '#2F6FB0'), lead: css('--lead', '#A3640F'), deep: css('--deep', '#463EAE'),
      good: css('--good', '#14906A'), warn: css('--warn', '#C0571F'),
      series: [css('--accent', '#463EAE'), css('--tp', '#14906A'), css('--fp', '#D4552B'), css('--eli5', '#2F6FB0'), css('--fn', '#B97A18'), css('--tn', '#8A929A')]
    };
  }
  function canvas(el, h) {
    var dpr = window.devicePixelRatio || 1, w = el.parentElement.clientWidth || 640;
    el.style.width = '100%'; el.style.height = h + 'px';
    el.width = Math.floor(w * dpr); el.height = Math.floor(h * dpr);
    var ctx = el.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    ctx.font = '12px ' + css('--font-body', 'sans-serif');
    return { ctx: ctx, w: w, h: h };
  }
  /* axes(ctx, w, h, pad, {x:[min,max], y:[min,max], xl, yl, xt:[ticks], yt:[ticks], xf, yf}) returns {X, Y} scale fns */
  function axes(ctx, w, h, pad, o) {
    var P = pal();
    var X = function (v) { return pad.l + (v - o.x[0]) / (o.x[1] - o.x[0]) * (w - pad.l - pad.r); };
    var Y = function (v) { return h - pad.b - (v - o.y[0]) / (o.y[1] - o.y[0]) * (h - pad.t - pad.b); };
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.fillStyle = P.faint; ctx.font = '11px ' + css('--font-body', 'sans-serif');
    (o.yt || []).forEach(function (t) {
      ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(pad.l, Y(t)); ctx.lineTo(w - pad.r, Y(t)); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(o.yf ? o.yf(t) : t, pad.l - 6, Y(t));
    });
    (o.xt || []).forEach(function (t) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(o.xf ? o.xf(t) : t, X(t), h - pad.b + 5);
    });
    ctx.beginPath(); ctx.moveTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b); ctx.stroke();
    ctx.fillStyle = P.muted; ctx.font = '12px ' + css('--font-body', 'sans-serif');
    if (o.xl) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(o.xl, (pad.l + w - pad.r) / 2, h - 2); }
    if (o.yl) { ctx.save(); ctx.font = '11px ' + css('--font-body', 'sans-serif'); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = P.muted; ctx.fillText('↑ ' + o.yl, pad.l + 6, pad.t + 2); ctx.restore(); }
    return { X: X, Y: Y };
  }
  function line(ctx, pts, color, width, dash) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width || 2; if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke(); ctx.restore();
  }
  function dot(ctx, x, y, r, color, ring) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    if (ring) { ctx.lineWidth = 2; ctx.strokeStyle = ring; ctx.stroke(); }
  }
  function text(ctx, s, x, y, color, align, size) {
    ctx.fillStyle = color || pal().muted; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.font = (size || 12) + 'px ' + css('--font-body', 'sans-serif'); ctx.fillText(s, x, y);
  }
  function rng(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function erf(x) { var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
  function ncdf(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
  function quantile(sorted, q) { if (!sorted.length) return NaN; var i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function fmt(x, d) { if (x == null || !isFinite(x)) return '—'; d = d === undefined ? 2 : d; return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function pct(x, d) { if (x == null || !isFinite(x)) return '—'; return fmt(x * 100, d || 0) + '%'; }
  function big(x) { if (!isFinite(x)) return '—'; var a = Math.abs(x); if (a >= 1e12) return fmt(x / 1e12, 1) + 'T'; if (a >= 1e9) return fmt(x / 1e9, 1) + 'B'; if (a >= 1e6) return fmt(x / 1e6, 1) + 'M'; if (a >= 1e3) return fmt(x / 1e3, 1) + 'K'; return fmt(x, 0); }
  function sci(x) { if (!isFinite(x) || x === 0) return String(x); var e = Math.floor(Math.log10(Math.abs(x))); return fmt(x / Math.pow(10, e), 2) + 'e' + e; }
  function softmax(z) { var m = Math.max.apply(null, z), e = z.map(function (v) { return Math.exp(v - m); }), s = sum(e); return e.map(function (v) { return v / s; }); }
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
  function $(root, sel) { return root.querySelector(sel); }
  function $$(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function on(els, ev, fn) { (Array.isArray(els) ? els : [els]).forEach(function (e) { if (e) e.addEventListener(ev, fn); }); }
  function widget(id, init) { reg.push({ id: id, init: init }); }
  var drawers = [];
  function boot() {
    reg.forEach(function (w) {
      var el = document.getElementById(w.id);
      if (!el) { console.warn('widget missing', w.id); return; }
      try { var d = w.init(el); if (typeof d === 'function') { drawers.push(d); d(); } }
      catch (e) { console.error('widget', w.id, e); }
    });
  }
  function redraw() { drawers.forEach(function (d) { try { d(); } catch (e) { console.error(e); } }); if (window.__legacyRedraw) window.__legacyRedraw.forEach(function (f) { try { f(); } catch (e) {} }); }
  return { css: css, pal: pal, canvas: canvas, axes: axes, line: line, dot: dot, text: text, rng: rng, gauss: gauss, erf: erf, ncdf: ncdf,
    quantile: quantile, mean: mean, sum: sum, fmt: fmt, pct: pct, big: big, sci: sci, softmax: softmax, sigmoid: sigmoid,
    $: $, $$: $$, on: on, widget: widget, boot: boot, redraw: redraw };
})();
