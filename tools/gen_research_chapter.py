#!/usr/bin/env python3
"""Generate src/sections/87-research-loops.html (private Part VII). The worked code lives in
tools/worked/ (chapters 81, 86 and 88); this chapter is the loop table, research defence, theory and drills."""
import html, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = ''

def block(name, upto=None):
    """Code between '# ---- name' and the next marker, dropping test lines (asserts, prints, toy setup)."""
    m = re.search(r'# ---- ' + re.escape(name) + r'\n(.*?)(?=\n# ---- |\Z)', src, re.S)
    lines = [l for l in m.group(1).split('\n') if not re.match(r'\s*(assert|print\(|rng =|X =|Wk, Wv|cache =|steps =|R =|A =|lp =|src =|target =|g = |Qe )', l)]
    code = '\n'.join(lines).strip('\n')
    if upto: code = code.split(upto)[0].rstrip()
    return f'<pre class="code" data-lang="python"><code>{html.escape(code, quote=False)}</code></pre>'

def fn(name):
    m = re.search(r'(def ' + name + r'\(.*?)(?=\n(?:def |#|[A-Za-z_]+ *=|assert|print)|\Z)', src, re.S)
    return f'<pre class="code" data-lang="python"><code>{html.escape(m.group(1).rstrip(), quote=False)}</code></pre>'

EQ = r'<div class="eq">\[ \text{DCG@}k = \sum_{i=1}^{k} \frac{2^{\text{rel}_i} - 1}{\log_2(i+1)}, \quad \text{NDCG@}k = \frac{\text{DCG@}k}{\text{IDCG@}k}, \quad \text{MRR} = \frac{1}{|Q|}\sum_q \frac{1}{\text{rank}_q} \]<span class="eqcap">NDCG rewards putting highly relevant items early, with a log discount; IDCG is the DCG of the ideal ordering. MRR looks only at the first relevant result. mAP averages per-class average precision, the area under the precision–recall envelope after matching detections to ground truth at an IoU threshold (0.5, or averaged over 0.5–0.95 for COCO).</span></div>'

page = f'''<section id="research-loops" data-title="Research and lab loops">
<h2>Research and lab loops: the question bank</h2>
<p>Chapter 80 mapped loops at Anthropic, OpenAI, Meta and Netflix. This chapter collects the research-scientist, applied-scientist and ML-engineer loops reported on r/OfferEngineering in 2026 at Google DeepMind, Google, Mistral, Amazon AGI, xAI, NVIDIA, Microsoft, Apple, TikTok and inference startups, then answers the questions this guide did not yet cover. Reports are self-selected summaries, mostly from an interview-prep vendor; treat them as question shapes, not rubrics.</p>

<div class="layer eli5"><div class="lh"><span class="badge">Plain words</span><span class="lt">Three things every research loop checks</span></div>
  <p>Can you defend your own work when someone keeps asking "why?" Can you explain the machinery of modern models quickly and correctly? Can you turn an idea into small, correct code under a clock? The mix changes by company: DeepMind's senior research loop had no coding at all, while Amazon AGI asked candidates to write GRPO in NumPy.</p>
</div>

<div class="layer lead"><div class="lh"><span class="badge">For leaders</span><span class="lt">How to weight preparation</span></div>
  <ul>
    <li><b>Research presentation and defence</b> appears in nearly every research loop (DeepMind, Mistral, TikTok, Meta, OpenAI MLE). It is often the round that decides.</li>
    <li><b>Rapid-fire fundamentals</b> (Mistral asked more than twenty; NVIDIA spent a whole screen on optimisation theory) punish half-remembered answers.</li>
    <li><b>ML coding is now LLM coding:</b> attention with a KV cache and grouped-query attention, GRPO advantages and loss, greedy and speculative decoding, nearest-centroid assignment, metric implementations.</li>
    <li><b>Design rounds are end to end:</b> data, reward, training, evaluation, serving, monitoring. "Use an LLM" is where the answer starts.</li>
  </ul>
</div>

<h3>The loops</h3>
<div class="tw"><table>
<thead><tr><th>Company · role</th><th>Rounds reported</th><th>Distinctive questions</th></tr></thead>
<tbody>
<tr><td><b>Google DeepMind</b> · senior research scientist</td><td>Research presentation with rapid follow-ups; no coding</td><td>Why this problem? Why this design? What if your central assumption fails? What is the next question? The candidate's evaluation-heavy work read as less differentiated than a new modelling or training method; post-training depth was the gap.</td></tr>
<tr><td><b>Mistral</b> · senior staff research scientist (efficient ML), 7 rounds</td><td>Prescreen; coding; oral logic and probability; research + 20 rapid-fire LLM questions; code review; behavioural; research talk + out-of-domain design</td><td>GPU memory organisation and Triton; add two integers given as strings; assign N×D points to the nearest of K×D centres (L2, vectorised); find 8 bugs in a replay buffer class.</td></tr>
<tr><td><b>Mistral</b> · senior SWE</td><td>Coding; system design</td><td>Unused capacity per compute pool (then two harder parts); an API turning a 1,000-page document into structured text through CPU rendering, GPU recognition and memory-heavy transformation stages.</td></tr>
<tr><td><b>Amazon AGI</b> · applied scientist</td><td>Hiring manager; three onsite rounds</td><td>Multi-head attention, then a KV cache, then grouped-query attention; design a chatbot from data to rewards to deployment; a NumPy notebook on GRPO with process and shaped rewards.</td></tr>
<tr><td><b>TikTok</b> · AI research scientist</td><td>Research deep dive; LLM and multimodal fundamentals; one algorithm problem</td><td>Have you read the technical reports of recent model generations, and what changed? Multimodal architecture. Why do modern LLMs use the normalisation they do?</td></tr>
<tr><td><b>Meta</b> · research scientist, MSL MLE, research engineer</td><td>Research design ×2; ML fundamentals; coding; AI coding; behavioural</td><td>Design a coding LLM; a chatbot with RL and a reward you must critique; LLMs in ranking with semantic IDs; implement attention and k-means; FlashAttention and linear attention.</td></tr>
<tr><td><b>xAI</b> · senior MLE</td><td>ML coding</td><td>Greedy decoding, then "speculative edits": use the original file as the draft, verify several tokens per step, produce identical output with fewer model calls.</td></tr>
<tr><td><b>NVIDIA</b> · MLE screen</td><td>45 minutes of optimisation theory</td><td>Does gradient descent find the global optimum? When is it guaranteed? Full-batch vs mini-batch vs SGD; is SGD noise bias or variance; escaping a shallow basin; train vs population gradient; sharp vs flat minima and batch size.</td></tr>
<tr><td><b>NVIDIA</b> · GPU performance SWE</td><td>Three specialised screens</td><td>Benchmark methodology; a GPU RDMA ping-pong microbenchmark; aligned <code>malloc</code> in C.</td></tr>
<tr><td><b>Google</b> · senior MLE</td><td>Coding ×3; ML design; behavioural</td><td>Longest subarray with average S on a stream; dependency scheduling with M workers; near-duplicate video detection at scale (embeddings, compression, ANN search, false positives, human review, quality vs latency).</td></tr>
<tr><td><b>Google</b> · data scientist (LLM)</td><td>Role-related knowledge case</td><td>Replace a copyright-claim classifier with an LLM: metrics, experiment design and statistics. Experimentation was the feedback gap.</td></tr>
<tr><td><b>Microsoft</b> · principal applied ML scientist</td><td>ML-fundamentals screen; three coding rounds; ML design</td><td>Word break; maximum subarray of an array concatenated K times; LeetCode 1338; data quality, class imbalance, drift.</td></tr>
<tr><td><b>Apple</b> · MLE</td><td>Team-specific</td><td>A "Python coding" round that was IoU and mean average precision; on-device memory, power, latency and privacy.</td></tr>
<tr><td><b>Fireworks AI</b> · applied MLE (AI allowed)</td><td>AI-assisted coding</td><td>Friend recommendations from mutual friends, a score bounded in [0, 1], NDCG.</td></tr>
<tr><td><b>Mercor</b> · applied AI scientist</td><td>Debugging + rapid LLM questions</td><td>An async refund function with retries: duplicate payments, state transitions, idempotency.</td></tr>
<tr><td><b>Scale AI</b> · senior MLE</td><td>LLM-fundamentals screen; NumPy coding</td><td>Why tokenize; KL during SFT; multi-head attention and top-p sampling in NumPy.</td></tr>
</tbody></table></div>

<h3>Defending your research</h3>
<div class="layer deep"><div class="lh"><span class="badge">Under the hood</span><span class="lt">A structure that survives interruption</span></div>
<ol class="steps">
<li><div><b>The question in one sentence,</b> and why it mattered then (what was broken or unknown).</div></li>
<li><div><b>The key idea and the one alternative you rejected,</b> with the reason. Interviewers ask "why not X?" first.</div></li>
<li><div><b>The evidence:</b> the main result with its uncertainty, the baseline, and the ablation that isolates your idea. Be ready for "is that difference outside the noise?" (<a href="index.html#evalstats">Statistics for eval sets</a>).</div></li>
<li><div><b>The weakest assumption,</b> said by you before they find it, and what happens if it fails.</div></li>
<li><div><b>What you would do next,</b> and what result would make you abandon the direction.</div></li>
</ol>
<p>When a question goes past what you tested, say so, then reason aloud about how you would find out. Reading recent technical reports (what changed between model generations in data, architecture, post-training and evaluation) is the preparation for TikTok-style "have you followed…" questions.</p>
</div>

<h3>Optimisation theory (NVIDIA screen)</h3>
<details class="qa"><summary>Does gradient descent always reach a global optimum? When is it guaranteed?</summary>
<p>No. It finds a stationary point. For a convex, L-smooth loss with step size at most 1/L it converges to a global minimum; for strongly convex losses, linearly. Deep-network losses are non-convex, but in very high dimensions most bad critical points are saddles, and SGD noise helps leave them (see <a href="index.html#learning">How networks learn</a>).</p></details>
<details class="qa"><summary>Full-batch vs mini-batch vs SGD. Is SGD noise bias or variance?</summary>
<p>The mini-batch gradient is an <b>unbiased</b> estimate of the full training gradient; its noise is <b>variance</b>, scaling as σ²/B for batch size B. Full batch: exact, expensive per step, can stall in sharp basins. SGD: cheap, noisy, parallelises poorly. Mini-batch trades the two and matches hardware. Noise can carry SGD out of a shallow basin that full-batch descent from the same start would settle in.</p></details>
<details class="qa"><summary>If the training gradient differs from the population gradient, which minima generalise better, and how does batch size matter?</summary>
<p>Flat minima: if the test loss surface is the training surface slightly shifted, a flat minimum loses little under the shift while a sharp one loses a lot. Small batches inject more noise, which the optimiser cannot settle into narrow basins with, so they tend to find flatter solutions; large batches tend toward sharper ones and a larger generalisation gap unless the learning rate is scaled up (Keskar et al. 2017). The effective noise scale is roughly learning rate ÷ batch size, which is why the linear scaling rule keeps behaviour similar when batch size grows.</p></details>

<h3>Normalisation and GPU basics (TikTok, Mistral)</h3>
<details class="qa"><summary>Why do modern LLMs use RMSNorm, and why pre-norm?</summary>
<p>RMSNorm divides by the root mean square and applies a learned scale, dropping LayerNorm's mean subtraction and bias: fewer operations, same stability in practice (Zhang and Sennrich 2019). Pre-norm (normalise before each attention and MLP block, add the residual after) keeps an unnormalised residual path, so gradients flow through deep stacks and training is stable without careful warm-up; post-norm can reach slightly better quality but is harder to train deep. Some recent models add QK-norm (normalising queries and keys) to stop attention logits growing.</p></details>
<details class="qa"><summary>How is GPU memory organised, and what is Triton?</summary>
<p>From fastest and smallest: registers per thread; shared memory / L1 per streaming multiprocessor (hundreds of KB, user-managed); L2 shared across the chip (tens of MB); HBM (80–192 GB at several TB/s). Fast kernels load a tile from HBM into shared memory once and reuse it many times, which is the whole idea of FlashAttention and of the roofline (<a href="index.html#inference--applied">roofline</a>). Triton is a Python-embedded language for writing GPU kernels at the level of blocks rather than threads: you write the tile computation, and its compiler handles thread mapping, memory coalescing and shared-memory use.</p></details>

<h3>The coding questions from these loops</h3>
<p>Every coding question in the table above is worked in full (questions to ask, approaches, a versioned build, edge cases, follow-ups) in <a href="#ml-coding">ML coding rounds</a> and <a href="#coding">Coding rounds</a>: <a href="#ml-attn">attention with a KV cache and GQA</a>, <a href="#ml-grpo">GRPO in NumPy</a>, <a href="#ml-spec">speculative edits</a>, <a href="#ml-km">nearest centre and k-means</a>, <a href="#ml-met">ranking and detection metrics</a>, <a href="#ml-nce">contrastive embeddings</a>, <a href="#ml-rb">the replay-buffer code review</a>, <a href="#ml-fof">friend recommendations</a>, <a href="#cw-avg">streaming average</a>, <a href="#cw-dag">task scheduling with M workers</a>, <a href="#cw-ms">Microsoft\'s three screens</a> and <a href="#cw-credit">cloud credit replay</a>. The design questions (near-duplicate video, the Mistral document pipeline, matmul sharding) are in <a href="#sd-prompts">reported prompts</a>. The concepts are taught in the public guide: optimisation theory in <a href="index.html#optimization--applied">Optimisation</a>, ranking metrics in <a href="index.html#classification--ranking">Classification metrics</a>, embedding training in <a href="index.html#assistant--applied">From predictor to assistant</a>, GPU memory in <a href="index.html#inference--applied">Inference</a>.</p>

<h3>Logic and probability drills (Mistral, Meta)</h3>
<details class="qa"><summary>Two ropes each burn in 60 minutes, unevenly. Measure 45 minutes.</summary>
<p>Light rope A at both ends and rope B at one end. A burns out in 30 minutes; at that moment light B's other end, so its remaining 30 minutes burns in 15. Total 45.</p></details>
<details class="qa"><summary>Expected number of fair coin flips to get two heads in a row.</summary>
<p>Let E be the expectation from scratch and E₁ after one head. E = 1 + ½E₁ + ½E and E₁ = 1 + ½·0 + ½E. Solving gives E = 6.</p></details>
<details class="qa"><summary>A test is 99% sensitive and 99% specific; prevalence is 1%. P(disease | positive)?</summary>
<p>0.99 × 0.01 ÷ (0.99 × 0.01 + 0.01 × 0.99) = 0.5. The same base-rate logic decides whether a classifier's flags are worth acting on (<a href="index.html#classification">Classification metrics</a>).</p></details>
<details class="qa"><summary>Sample uniformly from a stream of unknown length with O(1) memory.</summary>
<p>Reservoir sampling: keep the first item; replace the kept item with the i-th item with probability 1/i. By induction each item survives with probability 1/n.</p></details>
<details class="qa"><summary>Break a stick at two uniform random points. Probability the pieces form a triangle?</summary>
<p>1/4. Each piece must be shorter than one half; in the unit square of the two break points, that region has area 1/4.</p></details>

<h3>Sources</h3>
<p class="small">r/OfferEngineering, 2026: Mistral.AI Sr.Staff AI Research Scientist 7 Rounds; Mistral AI phone screen; Google DeepMind Senior AI Research Scientist Jun 2026; TikTok AI Research Scientist; Amazon AGI Applied Scientist Sep 2026; xAI Senior MLE speculative decoding; NVIDIA MLE phone screen ML fundamentals; NVIDIA GPU Performance SWE; Microsoft Principal Applied ML Scientist; Google Senior MLE Feb 2026; Google SWE (AI/ML) Aug 2026; Google MLE production ML; Google Senior Data Scientist LLM case; Apple MLE team-specific; Fireworks AI MLE; Mercor Applied AI Scientist; RAG system design interviews; Scale AI Senior MLE; Meta interview puzzle (two ropes). Keskar et al. 2017 on large-batch training and sharp minima; Zhang and Sennrich 2019 on RMSNorm.</p>
<p class="small">Collection: posts are listed with the Reddit search page in a browser and read by id with <code>tools/reddit_fetch.py</code>, which follows the anonymous mobile-app OAuth approach of <a href="https://github.com/omkarcloud/reddit-scraper">omkarcloud/reddit-scraper</a> (see also <a href="https://github.com/ksanjeev284/reddit-universal-scraper">ksanjeev284/reddit-universal-scraper</a>) through a residential proxy with sticky sessions.</p>
</section>
'''
out = os.path.join(ROOT, 'src', 'sections', '87-research-loops.html')
open(out, 'w', encoding='utf-8').write(page); print('wrote', out, len(page))
