/* Appendix: SQL logical execution order, stepped on the ten-row evals table. */
G.widget('w-sql-order', function (root) {
  var rows = [[1,'A','math',.62],[2,'A','code',.71],[3,'A','math',.58],[4,'A','chat',.88],[5,'B','math',.74],
              [6,'B','code',.69],[7,'B','math',.80],[8,'B','chat',.91],[9,'B','code',.77],[10,'B','chat',.35]];
  var Q = ["SELECT category, COUNT(*) AS n, AVG(score) AS mean_score", "FROM evals", "WHERE model = 'B'",
           "GROUP BY category", "HAVING AVG(score) >= 0.7", "ORDER BY mean_score DESC", "LIMIT 1"];
  var lineFor = [1, 2, 3, 4, 0, 5, 6];   // which written line each step runs
  var notes = [
    'FROM loads all 10 rows. Nothing else has happened yet.',
    'WHERE tests each row on its own and removes the 4 rows for model A. Aggregates and SELECT aliases do not exist yet.',
    'GROUP BY puts the 6 surviving rows into 3 groups. From now on each group becomes one output row.',
    'HAVING tests each group. chat averages 0.63 (one run scored 0.35), so the group is removed.',
    'SELECT computes the output columns and names them. Only now does mean_score exist.',
    'ORDER BY sorts the finished rows. It may use the alias mean_score because SELECT has already run.',
    'LIMIT keeps the first row: model B is strongest on math.'
  ];
  var btns = G.$$(root, '[data-steps] button'), qEl = G.$(root, '[data-q]'), tEl = G.$(root, '[data-t]'), out = G.$(root, '[data-out]');
  var step = 0;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function table(head, body) {
    return '<table><thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      body.map(function (r) { return '<tr' + (r.gone ? ' class="sql-gone"' : '') + '>' + r.c.map(function (v) {
        return '<td' + (typeof v === 'number' ? ' class="n"' : '') + '>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function groups() {
    var g = {}, order = [];
    rows.forEach(function (r) { if (r[1] !== 'B') return; if (!g[r[2]]) { g[r[2]] = []; order.push(r[2]); } g[r[2]].push(r); });
    return order.map(function (k) { var s = G.mean(g[k].map(function (r) { return r[3]; })); return { k: k, rows: g[k], mean: s }; });
  }
  function draw() {
    btns.forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === step)); });
    qEl.innerHTML = Q.map(function (l, i) {
      var done = lineFor.slice(0, step).indexOf(i) >= 0, now = lineFor[step] === i;
      return '<span class="' + (now ? 'sql-now' : done ? 'sql-done' : 'sql-todo') + '">' + esc(l) + '</span>';
    }).join('\n');
    var H = ['id', 'model', 'category', 'score'], html = '';
    if (step === 0) html = table(H, rows.map(function (r) { return { c: [r[0], r[1], r[2], G.fmt(r[3])] }; }));
    else if (step === 1) html = table(H, rows.map(function (r) { return { c: [r[0], r[1], r[2], G.fmt(r[3])], gone: r[1] !== 'B' }; }));
    else if (step === 2 || step === 3) {
      var body = [];
      groups().forEach(function (g) {
        g.rows.forEach(function (r, j) { body.push({ c: [j ? '' : g.k, r[0], G.fmt(r[3]), j ? '' : 'AVG ' + G.fmt(g.mean)], gone: step === 3 && g.mean < 0.7 }); });
      });
      html = table(['group', 'id', 'score', step === 3 ? 'HAVING test' : 'aggregate'], body);
    } else {
      var res = groups().filter(function (g) { return g.mean >= 0.7; });
      if (step >= 5) res.sort(function (a, b) { return b.mean - a.mean; });
      html = table(['category', 'n', 'mean_score'], res.map(function (g, i) {
        return { c: [g.k, g.rows.length, G.fmt(g.mean)], gone: step === 6 && i > 0 }; }));
    }
    tEl.innerHTML = html;
    out.textContent = notes[step];
  }
  btns.forEach(function (b) { G.on(b, 'click', function () { step = +b.dataset.s; draw(); }); });
  return draw;
});
