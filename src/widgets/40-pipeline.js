G.widget('w-pl-diag', function (root) {
  var STAGES = ['Data', 'Pretraining', 'Mid-training', 'SFT', 'Preference / RL', 'Safety', 'Evals / launch'];
  var SYM = [
    { s: 'Cannot spell or count letters', w: [0, 3, 0, 0, 0, 0, 0],
      why: 'Tokenization. The model sees subword tokens, not letters, so character-level tasks are hard. Fixed at pretraining time, not later.',
      check: 'Tokenize the failing words and look at the pieces. Test whether spacing the letters out fixes it.' },
    { s: 'Benchmark score jumped suspiciously', w: [3, 1, 1, 0, 0, 0, 2],
      why: 'Contamination: test items leaked into training data, often through web crawls or synthetic data built from benchmark-like prompts.',
      check: 'Run n-gram overlap between the benchmark and the training mix. Compare against a fresh, held-out variant of the benchmark.' },
    { s: 'Answers get longer, judge scores rise, users not happier', w: [0, 0, 0, 0, 3, 0, 2],
      why: 'Reward hacking on length. Reward models and LLM judges often prefer longer answers, so RL learns to pad.',
      check: 'Plot reward and judge score against length. Re-score with length-controlled win rate.' },
    { s: 'Agrees with whatever the user says', w: [0, 0, 0, 1, 3, 0, 0],
      why: 'Sycophancy. Human raters tend to prefer agreeable answers, and preference training amplifies that.',
      check: 'Probe with prompts that state a wrong belief. Compare SFT and RL checkpoints on the same probes.' },
    { s: 'Refuses harmless requests', w: [0, 0, 0, 1, 1, 3, 0],
      why: 'Over-refusal from safety tuning: refusal examples or penalties generalised beyond their intended boundary.',
      check: 'Run an over-refusal suite (benign prompts that look risky). Inspect which safety data covers similar surface patterns.' },
    { s: 'Fails on documents past 32K tokens', w: [0, 1, 3, 0, 0, 0, 1],
      why: 'Long-context extension in mid-training was too short or used data that only tests retrieval, not reasoning over the whole document.',
      check: 'Test real long-document tasks, not just needle-in-a-haystack. Check position-embedding scaling and the length mix in mid-training data.' },
    { s: 'Knows nothing after a certain date', w: [3, 2, 0, 0, 0, 0, 0],
      why: 'Knowledge cutoff of the pretraining crawl. Post-training cannot add much new factual knowledge reliably.',
      check: 'Confirm the crawl dates. Use retrieval or tools for recent facts instead of fine-tuning them in.' },
    { s: 'Lost a skill it had before RL', w: [0, 0, 0, 1, 3, 1, 1],
      why: 'Forgetting or over-optimisation: RL pushed the policy away from the reference model on tasks the reward did not cover.',
      check: 'Track the base-model eval suite on every RL checkpoint. Look at KL from the reference and the data mix of RL prompts.' },
    { s: 'Great offline, flat in the A/B test', w: [1, 0, 0, 0, 1, 0, 3],
      why: 'Offline evals do not match real traffic: different task mix, a harness that is not realistic, or a judge that disagrees with users.',
      check: 'Backtest offline deltas against past launches (see the offline to online gap chapter).' }
  ];
  var symBox = G.$(root, '[data-sym]'), stBox = G.$(root, '[data-stages]'), out = G.$(root, '[data-out]'), cur = 0;
  SYM.forEach(function (o, i) {
    var b = document.createElement('button'); b.className = 'b'; b.textContent = o.s; b.type = 'button';
    b.addEventListener('click', function () { cur = i; draw(); }); symBox.appendChild(b);
  });
  STAGES.forEach(function (n) { var d = document.createElement('div'); d.className = 'stage'; d.innerHTML = '<b>' + n + '</b><span></span>'; stBox.appendChild(d); });
  function draw() {
    var o = SYM[cur];
    G.$$(symBox, 'button').forEach(function (b, i) { b.setAttribute('aria-pressed', i === cur ? 'true' : 'false'); });
    G.$$(stBox, '.stage').forEach(function (d, i) {
      var w = o.w[i] || 0;
      d.style.borderColor = w === 3 ? 'var(--warn)' : w === 2 ? 'var(--lead)' : w === 1 ? 'var(--line-strong)' : 'var(--line)';
      d.style.background = w === 3 ? 'var(--warn-soft)' : w === 2 ? 'var(--lead-soft)' : 'var(--surface)';
      d.style.opacity = w ? 1 : 0.55;
      d.querySelector('span').textContent = w === 3 ? 'Most likely' : w === 2 ? 'Possible' : w === 1 ? 'Contributes' : '';
    });
    out.innerHTML = '<b>Why:</b> ' + o.why + '<br><b>First check:</b> ' + o.check;
  }
  return draw;
});
