G.widget('w-nt-sum', function (root) {
  var inp = G.$(root, '#nt-x'), sel = G.$(root, '#nt-e'), terms = G.$(root, '[data-terms]'), out = G.$(root, '[data-out]');
  var forms = G.$$(root, '.nt-f');
  function num(v) { return Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : G.fmt(v, Math.abs(v) < 1 ? 4 : 3); }
  function sub(i) { return 'x<sub>' + i + '</sub>'; }
  function chip(top, bottom, cls) { return '<span class="nt-chip ' + (cls || '') + '"><b>' + top + '</b><i>' + bottom + '</i></span>'; }
  function draw() {
    var e = sel.value;
    forms.forEach(function (f) { f.hidden = f.dataset.opt !== e; });
    var x = inp.value.split(/[,\s]+/).map(Number).filter(function (v) { return isFinite(v) && inp.value.trim() !== ''; });
    if (x.length < 2) { terms.innerHTML = ''; out.innerHTML = '<span style="color:var(--destructive)">Enter at least two numbers, separated by commas.</span>'; return; }
    var n = x.length, total = G.sum(x), mean = total / n, html = '', res = '';
    var plus = '<span class="nt-op">+</span>', times = '<span class="nt-op">×</span>';
    if (e === 'sum' || e === 'mean') {
      html = x.map(function (v, i) { return chip(num(v), sub(i + 1)); }).join(plus) + '<span class="nt-op">=</span>' + chip(num(total), 'Σ', 'res');
      if (e === 'mean') html += '<span class="nt-op">÷</span>' + chip(n, 'n', 'n') + '<span class="nt-op">=</span>' + chip(num(mean), '<span class="ovl">x</span>', 'res');
      res = e === 'sum' ? 'The sum of the ' + n + ' values is <b>' + num(total) + '</b>. In code: <code>sum(x)</code>.' : 'Add the ' + n + ' values (' + num(total) + ') and divide by n = ' + n + ': <b><span class="ovl">x</span> = ' + num(mean) + '</b>.';
    } else if (e === 'ss' || e === 'var') {
      var sq = x.map(function (v) { return (v - mean) * (v - mean); }), ss = G.sum(sq);
      html = x.map(function (v, i) { return chip('(' + num(v) + ' − ' + num(mean) + ')² = ' + num(sq[i]), '(' + sub(i + 1) + ' − <span class="ovl">x</span>)²'); }).join(plus) + '<span class="nt-op">=</span>' + chip(num(ss), 'Σ', 'res');
      if (e === 'var') html += '<span class="nt-op">÷</span>' + chip(n - 1, 'n − 1', 'n') + '<span class="nt-op">=</span>' + chip(num(ss / (n - 1)), 's²', 'res');
      res = 'The mean is ' + num(mean) + '. The distances from it always add to 0, which is why they are squared. Sum of squares <b>' + num(ss) + '</b>' + (e === 'var' ? ', divided by n − 1 = ' + (n - 1) + ' gives <b>s² = ' + num(ss / (n - 1)) + '</b> (SD s = ' + num(Math.sqrt(ss / (n - 1))) + ').' : '.');
    } else if (e === 'prod' || e === 'logsum') {
      var prod = x.reduce(function (a, b) { return a * b; }, 1);
      if (e === 'prod') {
        html = x.map(function (v, i) { return chip(num(v), sub(i + 1)); }).join(times) + '<span class="nt-op">=</span>' + chip(Math.abs(prod) > 1e6 || Math.abs(prod) < 1e-4 ? G.sci(prod) : num(prod), 'Π', 'res');
        res = 'Multiply all ' + n + ' values: <b>' + (Math.abs(prod) > 1e6 || Math.abs(prod) < 1e-4 ? G.sci(prod) : num(prod)) + '</b>. Try probabilities like 0.9, 0.5, 0.25 to see how fast a product of many probabilities shrinks.';
      } else {
        if (x.some(function (v) { return v <= 0; })) { terms.innerHTML = ''; out.innerHTML = '<span style="color:var(--destructive)">Logs need positive numbers. Try probabilities such as 0.9, 0.5, 0.25.</span>'; return; }
        var lg = x.map(Math.log), ls = G.sum(lg);
        html = x.map(function (v, i) { return chip('ln ' + num(v) + ' = ' + G.fmt(lg[i], 3), 'ln ' + sub(i + 1)); }).join(plus) + '<span class="nt-op">=</span>' + chip(G.fmt(ls, 4), 'Σ ln', 'res');
        res = 'The sum of logs is <b>' + G.fmt(ls, 4) + '</b>, the same as ln of the product (ln ' + (Math.abs(prod) < 1e-4 ? G.sci(prod) : num(prod)) + '). Divided by n and negated: <b>' + G.fmt(-ls / n, 3) + '</b>, which is a cross-entropy when the values are the probabilities of correct tokens.';
      }
    } else {
      var mx = Math.max.apply(null, x), im = x.indexOf(mx);
      html = x.map(function (v, i) { return chip(num(v), sub(i + 1), i === im ? 'res' : ''); }).join('<span class="nt-op"> </span>');
      res = '<b>max = ' + num(mx) + '</b> (the biggest value). <b>arg max = ' + (im + 1) + '</b> (its position). In code: <code>max(x)</code> and the index of it.';
    }
    terms.innerHTML = html; out.innerHTML = res;
  }
  G.on(inp, 'input', draw); G.on(sel, 'change', draw);
  return draw;
});
