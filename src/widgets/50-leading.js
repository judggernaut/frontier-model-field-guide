G.widget('w-ld-seeds', function (root) {
  var sd = G.$(root, '#ld-sd'), dd = G.$(root, '#ld-d'), cv = G.$(root, 'canvas'), out = G.$(root, '[data-out]');
  var sdo = G.$(root, '#ld-sd-o'), ddo = G.$(root, '#ld-d-o');
  var wrong = G.$(root, '[data-wrong]'), n80el = G.$(root, '[data-n80]'), ratio = G.$(root, '[data-ratio]');
  function power(n, d, s) { return G.ncdf(d / (s * Math.sqrt(2 / n)) - 1.96); }
  function draw() {
    var P = G.pal(), s = +sd.value, d = +dd.value;
    sdo.textContent = G.fmt(s, 1); ddo.textContent = G.fmt(d, 1);
    var n80 = Math.ceil(2 * Math.pow((1.96 + 0.8416) * s / d, 2));
    var nmax = 20;
    var c = G.canvas(cv, 220), ctx = c.ctx;
    var ax = G.axes(ctx, c.w, c.h, { l: 44, r: 14, t: 12, b: 36 }, { x: [1, nmax], y: [0, 1], xt: [1, 5, 10, 15, 20], yt: [0, .5, .8, 1], yf: function (v) { return Math.round(v * 100) + '%'; }, xl: 'seeds per arm', yl: 'power' });
    G.line(ctx, [[ax.X(1), ax.Y(.8)], [ax.X(nmax), ax.Y(.8)]], P.faint, 1, [4, 4]);
    var pts = []; for (var n = 1; n <= nmax; n += 0.25) pts.push([ax.X(n), ax.Y(power(n, d, s))]);
    G.line(ctx, pts, P.accent, 2.5);
    for (var k = 1; k <= nmax; k++) G.dot(ctx, ax.X(k), ax.Y(power(k, d, s)), 3, P.accent);
    if (n80 <= nmax) { G.dot(ctx, ax.X(n80), ax.Y(power(n80, d, s)), 6, P.good, P.surface); G.text(ctx, n80 + ' seeds', ax.X(n80) + 8, ax.Y(power(n80, d, s)) + 14, P.good); }
    var pw = G.ncdf(-d / (s * Math.SQRT2));
    wrong.textContent = G.pct(pw); n80el.textContent = n80 > 999 ? '>999' : n80; ratio.textContent = G.fmt(d / s, 2);
    out.textContent = 'With one seed per arm, a true gain of ' + G.fmt(d, 1) + ' points shows up with the wrong sign ' + G.pct(pw) +
      ' of the time. To detect it 80% of the time you need about ' + (n80 > 999 ? 'more than 999' : n80) + ' seeds per arm' +
      (n80 > 10 ? ', which is usually too expensive: shrink seed noise (bigger eval sets, paired items) or accept that this gain is below what you can resolve.' : '.');
  }
  G.on([sd, dd], 'input', draw);
  return draw;
});
