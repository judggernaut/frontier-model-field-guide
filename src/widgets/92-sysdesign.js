/* Appendix: transfer-time calculator (bits vs bytes) */
G.widget('w-sd-xfer', function (root) {
  var SIZES = [1e6, 1e7, 1e8, 1e9, 1e10, 5e10, 1e11, 1.4e11, 5e11, 1e12, 5e12, 1e13, 1e14];
  var ss = G.$(root, '#xf-size'), ls = G.$(root, '#xf-link'), es = G.$(root, '#xf-eff'), ds = G.$(root, '#xf-dl');
  function bytes(b) { var u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'], i = 0; while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; } return G.fmt(b, b < 10 && b % 1 ? 1 : 0) + ' ' + u[i]; }
  function dur(s) { if (s < 60) return G.fmt(s, s < 10 ? 1 : 0) + ' s'; if (s < 3600) return G.fmt(s / 60, 1) + ' min'; if (s < 86400) return G.fmt(s / 3600, 1) + ' h'; return G.fmt(s / 86400, 1) + ' days'; }
  function draw() {
    var size = SIZES[+ss.value], bits = +ls.value, eff = +es.value, dl = +ds.value;
    G.$(root, '#xf-size-o').textContent = bytes(size); G.$(root, '#xf-eff-o').textContent = G.pct(eff, 0);
    var Bps = bits / 8 * eff, t = size / Bps, n = Math.ceil(t / dl);
    G.$(root, '[data-bps]').textContent = bytes(Bps) + '/s';
    G.$(root, '[data-t]').textContent = dur(t);
    G.$(root, '[data-n]').textContent = String(n);
    G.$(root, '[data-out]').textContent = bytes(size) + ' = ' + G.big(size * 8) + ' bits. A ' + ls.options[ls.selectedIndex].text + ' link at ' + G.pct(eff, 0) +
      ' moves ' + bytes(Bps) + ' per second, so one link takes ' + dur(t) + '. ' + (n > 1 ? 'To finish within ' + ds.options[ds.selectedIndex].text + ' you need about ' + n + ' links in parallel (or that many peers each sending a share).' : 'One link meets the deadline.') +
      ' Reading the link as bytes instead of bits would have predicted ' + dur(t / 8) + ', eight times too optimistic.';
  }
  G.on([ss, es], 'input', draw); G.on([ls, ds], 'change', draw);
  return draw;
});
