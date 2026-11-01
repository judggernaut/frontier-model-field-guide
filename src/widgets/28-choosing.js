/* Chapter 28: three questions -> a metric recommendation for a classifier or judge. */
G.widget('w-ch-picker', function (root) {
  var st = { score: 'no', rare: 'yes', cost: 'fp' }, rec = G.$(root, '[data-rec]');
  function draw() {
    var s = st.score === 'yes', r = st.rare === 'yes', c = st.cost;
    var compare = s ? (r ? 'PR-AUC on the same labelled set. Report ROC-AUC beside it, but trust PR-AUC, since ROC-AUC flatters when positives are rare.' : 'ROC-AUC. It tells you how often a real positive outranks a real negative, without picking a threshold.')
      : (r ? 'Precision and recall for the rare class, plus its F1. A new version wins only if one number improves without the other dropping.' : 'Precision and recall for each class, plus macro F1. A new version wins only if the numbers improve together.');
    var op = c === 'fp' ? (s ? 'Pick the threshold that reaches your precision target, such as 95%, then report the recall you get there.' : 'Use stricter rubric wording until precision reaches your target. Report the recall you give up.')
      : c === 'fn' ? (s ? 'Pick the threshold that reaches your recall target, then report the precision you get there.' : 'Use more inclusive rubric wording until recall reaches your target. Report the precision you give up.')
      : (s ? 'If you can price both errors, minimise expected cost; otherwise take the threshold with the highest F1 on a validation split.' : 'Tune the wording for the highest F1 on a validation split, then freeze it.');
    var also = 'The confusion matrix at the operating point, n, and Cohen’s kappa against human labels on the same items.';
    also += (!r && c === 'eq') ? ' Accuracy is fine to show here, because classes are balanced and both mistakes cost the same.' : ' Keep accuracy out of the headline; it hides the mistakes you care about.';
    if (!s) also += ' If you can, get a score from logprobs or repeated votes so AUC becomes available.';
    rec.innerHTML = '<div><span class="k">Compare versions with</span><span>' + compare + '</span></div><div><span class="k">Set the operating point</span><span>' + op + '</span></div><div><span class="k">Also report</span><span>' + also + '</span></div>';
  }
  G.$$(root, '[data-k]').forEach(function (g) {
    var key = g.dataset.k, bs = G.$$(g, 'button');
    bs.forEach(function (b) {
      G.on(b, 'click', function () {
        st[key] = b.dataset.v;
        bs.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        draw();
      });
    });
  });
  return draw;
});
