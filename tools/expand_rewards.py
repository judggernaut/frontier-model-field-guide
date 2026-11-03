#!/usr/bin/env python3
"""One-off: expand chapter 47 with reward basics, uses, what makes a good RM, validation, and pitfalls."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'src', 'sections', '47-reward-models.html')

BASICS = r'''<h3 id="reward-models--basics">Rewards from the ground up</h3>
<p>Before reward <i>models</i>, the plain idea: a reward is a number that says how good an outcome was. Reinforcement learning (RL) changes the model to make high-reward outputs more likely. Everything else in this chapter is about where that number comes from and whether you can trust it.</p>

<div class="layer eli5"><div class="lh"><span class="badge">Plain words</span><span class="lt">Points for a dog trick</span></div>
  <p>Teaching a dog a trick works by giving a treat when it does something right. The dog does not understand your goal; it only learns which actions earn treats. A reward for a language model is the treat: after the model writes an answer, something gives it a score, and training nudges the model towards answers that score well.</p>
  <p>The score can come from several places. A program can check it (did the code pass the tests? is the maths answer 42?). A person can judge it. Or a <b>reward model</b>, a separate network trained to predict what people would prefer, can judge it instantly. The model being trained will chase whatever the scorer rewards, including its mistakes, so the scorer is the most important design decision in the whole process.</p>
</div>

<div class="layer lead"><div class="lh"><span class="badge">For leaders</span><span class="lt">Why rewards are everywhere in post-training</span></div>
  <p>A reward turns "better" into a number a computer can optimise and compare at scale. Once you have one, it gets reused far beyond RL:</p>
  <div class="tw"><table>
  <thead><tr><th>Use</th><th>What the reward does</th><th>Where in this guide</th></tr></thead>
  <tbody>
  <tr><td>RLHF and RL fine-tuning</td><td>The objective the policy is trained to maximise</td><td><a href="#rlhf">RLHF and PPO</a>, <a href="#grpo">GRPO</a></td></tr>
  <tr><td>Best-of-N sampling</td><td>Picks the best of N samples at inference time</td><td><a href="#inference">Inference</a></td></tr>
  <tr><td>Rejection sampling for SFT data</td><td>Keeps only high-scoring samples as new training data</td><td><a href="#sft">SFT</a>, <a href="#distillation">Distillation</a></td></tr>
  <tr><td>Preference-pair construction for DPO</td><td>Labels which of two samples is "chosen"</td><td><a href="#dpo">DPO</a></td></tr>
  <tr><td>Data filtering and curriculum</td><td>Scores and drops low-quality or too-easy examples</td><td><a href="#pretraining">Pretraining</a></td></tr>
  <tr><td>Evaluation and dashboards</td><td>A cheap automatic quality score between human evals</td><td><a href="#judges">LLM as judge</a></td></tr>
  <tr><td>Production routing and guardrails</td><td>Decides retries, fallbacks, or blocks</td><td><a href="#safety">Safety</a></td></tr>
  </tbody></table></div>
  <p>The reuse is the risk. One reward model often trains the policy, selects its data, and grades the result. If it has a blind spot, every one of those steps shares it, and the evaluation cannot catch what the training exploited. Insist that at least one evaluation signal is independent of the training reward.</p>
</div>

<div class="layer deep"><div class="lh"><span class="badge">Under the hood</span><span class="lt">The objective and the reward zoo</span></div>
<p>For a prompt \(x\) and a response \(y\) sampled from the policy \(\pi_\theta\), post-training RL maximises expected reward while staying close to a reference model:</p>
<div class="eq">\[ \max_\theta\ \mathbb{E}_{x \sim \mathcal{D},\, y \sim \pi_\theta(\cdot\mid x)}\big[r(x,y)\big] \;-\; \beta\, \mathrm{KL}\big(\pi_\theta \,\|\, \pi_\text{ref}\big) \]<span class="eqcap">\(r(x,y)\) is the scalar reward for the whole response; \(\beta\) sets how far the policy may drift from \(\pi_\text{ref}\), usually the SFT model. The KL term is the leash that limits how hard the policy can exploit \(r\).</span></div>
<div class="tw"><table>
<thead><tr><th>Reward source</th><th>Signal</th><th>Strength</th><th>Main weakness</th></tr></thead>
<tbody>
<tr><td>Rule or verifier (tests, exact answer, proof checker)</td><td>Usually 0/1 per response</td><td>Cheap, precise where it applies</td><td>Only for checkable tasks; sparse; weak tests are gamed</td></tr>
<tr><td>Learned reward model (Bradley–Terry)</td><td>Scalar per response</td><td>Covers open-ended quality; milliseconds per score</td><td>Inherits label biases; exploitable off its training distribution</td></tr>
<tr><td>Generative judge (LLM with a rubric)</td><td>Score or verdict plus rationale</td><td>Flexible, explainable, no training needed</td><td>Slow and costly; position, length and self-preference biases</td></tr>
<tr><td>Process reward model</td><td>Score per reasoning step</td><td>Dense credit assignment</td><td>Step labels are expensive; steps can look right and be wrong</td></tr>
<tr><td>Human ratings</td><td>Preference or score</td><td>The ground truth you care about</td><td>Too slow and expensive for training-loop volume</td></tr>
</tbody></table></div>
<p><b>Sparse and dense.</b> A single score at the end of a long response tells the optimiser that something in 2,000 tokens was good or bad, but not what. That is credit assignment, and it is why RL on long outputs needs many samples (GRPO's group of G samples per prompt), value baselines (PPO), or per-step rewards (process reward models). Real reward functions are often a sum: a learned score, plus format checks, plus penalties for length or for unsafe content. Each added term is another thing to tune and another thing to exploit.</p>
</div>

'''

GOOD = r'''<h3 id="reward-models--good">What makes a good reward model, and how you know</h3>
<p>Held-out accuracy is the first number people quote and the least sufficient one. A reward model is good if optimising against it makes the policy better by an independent measure, for longer, before it starts to break. The properties below are what makes that happen, and each has a test.</p>

<div class="layer eli5"><div class="lh"><span class="badge">Plain words</span><span class="lt">A good referee, not just a well-read one</span></div>
  <p>A good referee agrees with experienced fans on ordinary plays, but more importantly, players cannot fool them. A diver who falls dramatically should not win free kicks. A reward model faces a player whose only job is to find its weaknesses, so what matters is not only "does it agree with people on normal answers?" but "does it still agree on the strange answers a model will produce once it starts trying to please it?"</p>
</div>

<div class="layer lead"><div class="lh"><span class="badge">For leaders</span><span class="lt">The six properties to ask about</span></div>
<div class="tw"><table>
<thead><tr><th>Property</th><th>What it means</th><th>Evidence to ask for</th></tr></thead>
<tbody>
<tr><td><b>Accurate where it will be used</b></td><td>Agrees with people on samples from the <i>current</i> policy, not only on the training distribution</td><td>Pairwise accuracy on fresh policy samples, next to human–human agreement on the same pairs</td></tr>
<tr><td><b>Balanced across slices</b></td><td>No category where it is near chance</td><td>Per-slice accuracy with intervals: code, maths, safety, long answers, multi-turn, languages</td></tr>
<tr><td><b>Robust to surface features</b></td><td>Score does not move when meaning does not</td><td>Counterfactual probes: padding, formatting, confident tone, flattery, reordered options</td></tr>
<tr><td><b>Calibrated</b></td><td>A predicted 80% preference wins about 80% of the time</td><td>Reliability diagram on held-out pairs; expected calibration error</td></tr>
<tr><td><b>Knows when it does not know</b></td><td>Uncertainty rises off-distribution</td><td>Ensemble disagreement that grows on out-of-distribution or adversarial inputs</td></tr>
<tr><td><b>Optimisable</b></td><td>Pushing on it improves true quality for a long way</td><td>Best-of-N and short RL runs scored by humans or a held-out judge; where the gold curve peaks</td></tr>
</tbody></table></div>
<p>The last row is the one that decides. Two reward models with the same RewardBench score can train very different policies; recent work comparing static benchmark accuracy with downstream RL results finds only a loose relationship. Ask for the downstream curve.</p>
</div>

<div class="widget" id="w-rm-bon">
  <div class="wtitle">Best-of-N with an imperfect reward model</div>
  <div class="wsub">Each prompt gets N candidate answers. The reward model picks the top one. Raise the length bias and watch the true quality of the pick stop rising, then fall, while the reward model's own score keeps climbing.</div>
  <div class="controls">
    <div class="ctl"><label for="bn-rho">Reward model agreement with true quality: <output id="bn-rho-o">0.7</output></label><input type="range" id="bn-rho" min="0.1" max="0.95" step="0.05" value="0.7"></div>
    <div class="ctl"><label for="bn-b">Length bias in the reward model: <output id="bn-b-o">0.5</output></label><input type="range" id="bn-b" min="0" max="1.5" step="0.1" value="0.5"></div>
  </div>
  <canvas></canvas>
  <div class="cards">
    <div class="mc"><div class="l">True quality at N = 1</div><div class="v" data-q1>—</div></div>
    <div class="mc"><div class="l">Best N for true quality</div><div class="v" data-best>—</div></div>
    <div class="mc"><div class="l">True quality at N = 256</div><div class="v" data-q256>—</div></div>
  </div>
  <div class="readout" data-out></div>
</div>

<div class="layer deep"><div class="lh"><span class="badge">Under the hood</span><span class="lt">A validation protocol, in order</span></div>
<ol class="steps">
<li><div><b>Agreement ceiling.</b> Have two or three people label the same 500–1,000 held-out pairs. Their agreement rate is the target; reward model accuracy is reported as a fraction of it.</div></li>
<li><div><b>Held-out accuracy with intervals, per slice.</b> Treat each pair as a binary prediction; a few thousand pairs give roughly ±1.5 points. Cluster intervals by prompt when one prompt contributes several pairs (<a href="#intervals">Intervals and clustering</a>).</div></li>
<li><div><b>On-policy accuracy.</b> Sample pairs from the policy you are about to train, have people label them, and measure again. The drop from step 2 is the distribution-shift penalty.</div></li>
<li><div><b>Counterfactual probes.</b> For each known bias, build pairs that differ only in that feature (length, markdown, hedging, agreement with the user, option order). A robust model prefers neither side about half the time; report the preference rate with an interval.</div></li>
<li><div><b>Calibration.</b> Bin held-out pairs by predicted probability \(\sigma(r_w - r_l)\); plot predicted against observed win rate.</div></li>
<li><div><b>Best-of-N curve.</b> For N = 1, 2, 4, …, 64, pick the top-scoring sample and score it with a gold signal (people, or a larger held-out judge). The curve should rise and keep rising; a peak at small N means the model is exploitable.</div></li>
<li><div><b>Short RL canary.</b> Train briefly against the reward and track gold quality, response length and KL together. Compare reward models by where the gold curve peaks, as in the overoptimisation chart below.</div></li>
</ol>
<p>Pairwise accuracy is a concordance statistic, so its relation to classification metrics is exact: on randomly ordered pairs it estimates the same quantity as ROC-AUC (<a href="#classification">Classification metrics</a>). Calibration matters because RL uses score <i>gaps</i>, not just their sign: an overconfident model turns small, noisy differences into large advantages.</p>
<div class="eq">\[ \text{ECE} = \sum_{b} \frac{n_b}{n}\,\big|\,\bar p_b - \hat w_b\,\big| \]<span class="eqcap">Expected calibration error over bins \(b\): \(\bar p_b\) the mean predicted preference probability in the bin, \(\hat w_b\) the observed share of pairs where the higher-scored response was the one people chose, \(n_b\) pairs in the bin.</span></div>
</div>
<div class="callout eval"><span class="tag">Eval lens</span><div>A reward model is a measuring instrument and an optimisation target at once. Validate it the way you would validate any instrument (agreement, slices, calibration), then validate it as a target (best-of-N and RL canaries against a gold signal). Only the second kind of evidence tells you how hard you can push.</div></div>

'''

PITFALLS = r'''<h3 id="reward-models--pitfalls">Gotchas and pitfalls</h3>
<p>Most reward failures are ordinary engineering mistakes that only show up once an optimiser leans on them. This list collects the ones that recur across published reports and internal post-mortems, with the symptom you will see first.</p>

<div class="layer eli5"><div class="lh"><span class="badge">Plain words</span><span class="lt">Small cracks, big pressure</span></div>
  <p>A slightly wobbly ruler is fine for measuring a table. It is not fine if someone is paid by the centimetre and gets to choose where you measure. Training pushes on the reward millions of times, so tiny flaws that would never matter in a one-off check become the thing the model learns.</p>
</div>

<div class="layer lead"><div class="lh"><span class="badge">For leaders</span><span class="lt">Symptoms to watch on the dashboard</span></div>
  <ul>
    <li>Training reward rises smoothly while independent evals flatten: <b>overoptimisation</b>.</li>
    <li>Average response length or markdown use climbs steadily: <b>length or format exploit</b>.</li>
    <li>The model agrees with users more and pushes back less: <b>sycophancy rewarded</b>.</li>
    <li>Refusals rise on harmless prompts after a safety reward is added: <b>over-refusal</b>.</li>
    <li>Reward jumps after a reward-model retrain with no policy change: <b>unnormalised scores</b>.</li>
    <li>Reward variance within a GRPO group collapses to zero on most prompts: <b>saturated or too-easy reward</b>, no learning signal left.</li>
  </ul>
</div>

<div class="layer deep"><div class="lh"><span class="badge">Under the hood</span><span class="lt">Twelve pitfalls, grouped</span></div>
<div class="tw"><table>
<thead><tr><th>Pitfall</th><th>What goes wrong</th><th>Fix</th></tr></thead>
<tbody>
<tr><td colspan="3"><b>Data</b></td></tr>
<tr><td>Stale comparisons</td><td>Trained on an old policy's outputs; the new policy's mistakes are out of distribution</td><td>Collect in rounds on current samples</td></tr>
<tr><td>Dropped ties and "both bad"</td><td>Dataset skews to easy, clear pairs; model is overconfident on hard ones</td><td>Keep a tie class or a margin-aware loss; report the drop rate</td></tr>
<tr><td>Rubric conflicts hidden in one label</td><td>"Overall better" hides whether helpfulness or safety won</td><td>Per-dimension labels or separate heads, combined deliberately</td></tr>
<tr><td>Eval pairs from the training pool</td><td>Held-out accuracy is optimistic (prompt overlap)</td><td>Split by prompt, not by pair; deduplicate near-duplicates (<a href="#contamination">Contamination</a>)</td></tr>
<tr><td colspan="3"><b>Model</b></td></tr>
<tr><td>Reward model much smaller than the policy</td><td>The policy learns to fool a judge that understands less than it does</td><td>Same family and comparable size; ensembles for the hardest slices</td></tr>
<tr><td>Second epoch of training</td><td>Training accuracy up, held-out down; overconfident scores</td><td>One epoch is common; early-stop on held-out loss</td></tr>
<tr><td>Truncation or template mismatch</td><td>Long responses cut off, or a chat template different from the policy's, so the RM scores the wrong text</td><td>Same tokenizer and template; check max length against the response distribution</td></tr>
<tr><td colspan="3"><b>Use</b></td></tr>
<tr><td>Raw, unnormalised scores</td><td>Scale and offset shift between RM versions and prompts; RL step size changes silently</td><td>Normalise against a reference set; whiten per batch or per group</td></tr>
<tr><td>Summed objectives with fixed weights</td><td>The optimiser finds the corner where the easy term dominates</td><td>Gate terms (style counts only if correct); monitor each term</td></tr>
<tr><td>No KL or too little</td><td>Fast drift into the region where the RM is wrong</td><td>Tune β against a gold signal, not against training reward</td></tr>
<tr><td>Same RM trains and evaluates</td><td>Evaluation cannot see what training exploited</td><td>An independent judge, fresh human ratings, task checks</td></tr>
<tr><td>Policy can see or touch the scorer</td><td>Prompt injection into an LLM judge; editing tests; reading answer files</td><td>Isolate the scorer; sandbox; hidden tests; audit high-reward samples by hand</td></tr>
</tbody></table></div>
<p>The cheapest check in this list is the last one: read the 20 highest-reward samples from each run. Exploits are usually obvious to a person within a minute, and invisible in aggregate metrics for days.</p>
</div>

'''

s = open(P, encoding='utf-8').read()
if 'reward-models--basics' in s: raise SystemExit('already applied')
s = s.replace('<h3>Why preferences instead of labels</h3>', BASICS + '<h3>Why preferences instead of labels</h3>', 1)
s = s.replace('<h3>Reward overoptimization: Goodhart in one chart</h3>', GOOD + '<h3>Reward overoptimization: Goodhart in one chart</h3>', 1)
s = s.replace('<h3 id="reward-models--applied">', PITFALLS + '<h3 id="reward-models--applied">', 1)
open(P, 'w', encoding='utf-8').write(s); print('ok')
