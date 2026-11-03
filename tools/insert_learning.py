#!/usr/bin/env python3
"""One-off: add the learning material behind the research-loop questions to public chapters (idempotent)."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = lambda f: os.path.join(ROOT, 'src', 'sections', f)

def insert_before_end(f, marker, block):
    p = S(f); s = open(p, encoding='utf-8').read()
    if marker in s: print('skip', f); return
    i = s.rstrip().rfind('</section>'); s = s[:i] + block.strip('\n') + '\n' + s[i:]
    open(p, 'w', encoding='utf-8').write(s); print('added', f)

def insert_before(f, anchor, marker, block):
    p = S(f); s = open(p, encoding='utf-8').read()
    if marker in s: print('skip', f); return
    assert anchor in s, (f, anchor)
    s = s.replace(anchor, block.strip('\n') + '\n' + anchor, 1)
    open(p, 'w', encoding='utf-8').write(s); print('added', f)

OPT = r'''
<h3 id="optimization--applied">Applied: noise, convexity, and flat minima</h3>
<p>ML-fundamentals screens (NVIDIA's ran 45 minutes on exactly this) ask why stochastic gradient descent works as well as it does. Four ideas answer most of the questions.</p>

<div class="layer eli5"><div class="lh"><span class="badge">Plain words</span><span class="lt">Walking downhill in fog, on a slightly different hill</span></div>
  <p>Gradient descent walks downhill. With the whole dataset it knows the exact slope; with a small batch it guesses the slope from a few examples, so each step wobbles. The wobble is not all bad: it can shake the walker out of a small dip that is not the real bottom. And because the hill you train on is only a sample of the real one, it is safer to stop in a wide, flat valley than in a narrow pit: if the real hill is shifted a little, a wide valley is still low, a narrow pit is not.</p>
</div>

<div class="layer lead"><div class="lh"><span class="badge">For leaders</span><span class="lt">Why batch size and learning rate move together</span></div>
  <p>Bigger batches mean fewer, steadier steps and better GPU use, but also less noise. Past a point the run needs a higher learning rate to keep the same behaviour, and very large batches can generalise slightly worse unless tuned. When a team changes batch size, ask whether they rescaled the learning rate and re-checked held-out loss, not just training loss.</p>
</div>

<div class="layer deep"><div class="lh"><span class="badge">Under the hood</span><span class="lt">Four answers, with the math</span></div>
<p><b>1. Global optimum.</b> Gradient descent finds a point where the gradient is zero. If the loss is convex and \(L\)-smooth, a step size \(\eta \le 1/L\) converges to a global minimum, with error \(O(1/t)\); strongly convex losses converge linearly. Neural-network losses are not convex, so there is no such guarantee; in high dimensions most bad critical points are saddles rather than poor local minima, and noise helps escape them.</p>
<p><b>2. Mini-batch noise is variance, not bias.</b></p>
<div class="eq">\[ g_B = \frac{1}{B}\sum_{i \in B} \nabla \ell_i(\theta), \qquad \mathbb{E}[g_B] = \nabla L_\text{train}(\theta), \qquad \mathrm{Cov}[g_B] \approx \frac{\Sigma}{B} \]<span class="eqcap">A random mini-batch gradient is an unbiased estimate of the full training gradient; its noise covariance shrinks as \(1/B\). \(\Sigma\) is the per-example gradient covariance.</span></div>
<p><b>3. Training gradient is not the population gradient.</b> \(\nabla L_\text{train}\) estimates \(\nabla L_\text{pop}\) from a finite sample, so even full-batch descent optimises a slightly wrong surface. A minimum whose loss barely changes under small perturbations of \(\theta\) (a flat minimum, small Hessian eigenvalues) keeps low loss when the surface shifts; a sharp one does not. That is the usual explanation of the generalisation gap.</p>
<p><b>4. Batch size, learning rate and sharpness.</b> The noise SGD injects scales roughly with \(\eta / B\). More noise prevents settling into narrow basins, so smaller batches (or larger learning rates) tend to find flatter minima; very large batches tend toward sharper minima and a larger generalisation gap unless the learning rate is raised (Keskar et al. 2017). The linear scaling rule, multiply \(\eta\) by \(k\) when \(B\) grows by \(k\), with warmup, keeps \(\eta/B\) and so the noise level roughly constant (Goyal et al. 2017). It holds up to the critical batch size above.</p>
<details class="qa"><summary>Started near a shallow local minimum: which escapes, full-batch or SGD?</summary>
<p>Full-batch descent with a small step slides into the shallow basin and stays: the gradient there is zero. SGD's noisy steps can carry it over a low barrier into the deeper basin, with probability that rises with the noise level \(\eta/B\) and falls with the barrier height.</p></details>
</div>
<div class="callout eval"><span class="tag">Eval lens</span><div>Sharpness and generalisation claims are about held-out loss. When comparing runs with different batch sizes, compare at matched compute or matched tokens, and report held-out loss with seed variation, not training loss.</div></div>
'''

RANK = r'''
<h3 id="classification--ranking">Ranking and detection: NDCG, MRR, recall@k, IoU and mAP</h3>
<p>Classification metrics score one decision per item. Search, recommendation, retrieval-augmented generation and object detection produce ranked lists or boxes, and use their own metrics built from the same parts.</p>

<div class="layer eli5"><div class="lh"><span class="badge">Plain words</span><span class="lt">The first page of results is what counts</span></div>
  <p>A search that finds the right answer at position 50 is nearly useless; at position 1 it is perfect. Ranking metrics give more credit for good results near the top. Detection is similar for pictures: a predicted box counts as a hit only if it overlaps the real object enough.</p>
</div>

<div class="layer lead"><div class="lh"><span class="badge">For leaders</span><span class="lt">Which one to ask for</span></div>
  <ul>
    <li><b>Recall@k</b> for retrieval feeding an LLM: did the right passage make it into the k the model sees? If not, nothing downstream can fix it.</li>
    <li><b>MRR</b> when there is one right answer and users take the first good result.</li>
    <li><b>NDCG@k</b> when relevance is graded (perfect, good, fair) and order matters.</li>
    <li><b>mAP at an IoU threshold</b> for detection. COCO-style mAP averages thresholds from 0.5 to 0.95 and is much stricter than mAP@0.5.</li>
    <li>Offline ranking gains do not guarantee online gains: confirm with an <a href="#abtest">A/B test</a>.</li>
  </ul>
</div>

<div class="layer deep"><div class="lh"><span class="badge">Under the hood</span><span class="lt">Definitions</span></div>
<div class="eq">\[ \text{DCG@}k=\sum_{i=1}^{k}\frac{2^{\text{rel}_i}-1}{\log_2(i+1)},\quad \text{NDCG@}k=\frac{\text{DCG@}k}{\text{IDCG@}k},\quad \text{MRR}=\frac{1}{|Q|}\sum_{q}\frac{1}{\text{rank}_q},\quad \text{recall@}k=\frac{|\text{relevant}\cap\text{top-}k|}{|\text{relevant}|} \]<span class="eqcap">\(\text{rel}_i\) is the graded relevance of the item at position \(i\); IDCG is the DCG of the best possible ordering of all relevant items (computing it from only the returned items inflates NDCG); \(\text{rank}_q\) is the position of the first relevant item for query \(q\) (contributing 0 if none).</span></div>
<p><b>Worked example.</b> Relevances in ranked order (0, 2, 3): DCG@3 = 0 + 3/log₂3 + 7/2 = 1.89 + 3.5 = 5.39. Ideal order (3, 2, 0): 7 + 3/1.585 + 0 = 8.89. NDCG@3 = 5.39 / 8.89 = 0.61.</p>
<div class="eq">\[ \text{IoU}(A,B)=\frac{|A\cap B|}{|A\cup B|},\qquad \text{AP}=\sum_n (r_n - r_{n-1})\,p^{\text{interp}}_n \]<span class="eqcap">Detections are sorted by score and matched greedily to unmatched ground-truth boxes with IoU above a threshold; a second detection of the same object is a false positive. \(p^{\text{interp}}\) is the precision envelope (the highest precision at any equal or higher recall). mAP averages AP over classes, and for COCO over IoU thresholds 0.5:0.05:0.95.</span></div>
<p>Boxes (0,0,2,2) and (1,1,3,3) overlap in a 1×1 square: IoU = 1 / (4 + 4 − 1) = 1/7 ≈ 0.14, a miss at threshold 0.5. Report these metrics with intervals across queries or images, as in <a href="#intervals">Intervals and the bootstrap</a>.</p>
</div>
'''

EMB = r'''
<h3 id="assistant--embeddings">Applied: training retrieval embeddings</h3>
<p>When a design discussion reaches "we'll embed the documents", the next question is often "how would you make the embeddings better for this domain?" The answer is contrastive training.</p>
<div class="layer eli5"><div class="lh"><span class="badge">Plain words</span><span class="lt">Put matching pairs close together</span></div>
  <p>An embedding model turns text into a point on a map so that similar meanings sit close together. To teach it your domain, show it pairs that should match (a question and the passage that answers it) and pull them together, while pushing apart passages that do not match. The most useful non-matches are the tricky ones that look relevant but are not.</p>
</div>
<div class="layer lead"><div class="lh"><span class="badge">For leaders</span><span class="lt">When fine-tuning embeddings pays</span></div>
  <p>Off-the-shelf embeddings miss domain vocabulary (internal product names, legal or clinical terms). If retrieval recall@k on your golden set is the bottleneck, a few thousand labelled question–passage pairs, or pairs mined from logs, usually move it more than a bigger generator model. Check that the evaluation queries are not in the training pairs.</p>
</div>
<div class="layer deep"><div class="lh"><span class="badge">Under the hood</span><span class="lt">InfoNCE, in-batch and hard negatives</span></div>
<div class="eq">\[ \mathcal{L} = -\frac{1}{B}\sum_{i=1}^{B}\log\frac{\exp(q_i\cdot p_i/\tau)}{\sum_{j=1}^{B}\exp(q_i\cdot p_j/\tau)+\sum_{n}\exp(q_i\cdot p^-_{i,n}/\tau)} \]<span class="eqcap">\(q_i, p_i\) unit-length query and positive embeddings; the other positives in the batch serve as negatives (in-batch negatives); \(p^-_{i,n}\) are mined hard negatives; \(\tau\) a temperature (often 0.01–0.1) that sets how sharply near-misses are penalised.</span></div>
<p>Larger batches give more negatives per step. Hard negatives, mined with BM25 or the current model, teach far more than random ones, but many mined "negatives" are actually relevant and unlabelled: filter them with a cross-encoder or a score margin. Duplicate passages within a batch become false negatives; deduplicate. Evaluate with recall@k and MRR (<a href="#classification--ranking">ranking metrics</a>) on held-out queries, then on end-to-end answer quality.</p>
</div>
'''

GPU = r'''
<h3 id="inference--gpu">Applied: GPU memory, kernels and Triton</h3>
<div class="layer eli5"><div class="lh"><span class="badge">Plain words</span><span class="lt">A desk, a bookshelf and a warehouse</span></div>
  <p>A GPU has a tiny, very fast desk next to each group of workers, a bigger shelf shared by the whole chip, and a large but slower warehouse (the HBM). Fast code carries a block of data from the warehouse to the desk once and does as much work on it as possible before fetching the next block.</p>
</div>
<div class="layer deep"><div class="lh"><span class="badge">Under the hood</span><span class="lt">The hierarchy, and what a kernel does with it</span></div>
<div class="tw"><table><thead><tr><th>Level</th><th>Size (H100, approximate)</th><th>Shared by</th></tr></thead><tbody>
<tr><td>Registers</td><td>256 KB per streaming multiprocessor (SM)</td><td>one thread each</td></tr>
<tr><td>Shared memory / L1</td><td>up to 228 KB per SM, programmer-managed</td><td>one thread block</td></tr>
<tr><td>L2 cache</td><td>50 MB</td><td>whole chip</td></tr>
<tr><td>HBM</td><td>80 GB at 3.35 TB/s</td><td>whole chip</td></tr>
</tbody></table></div>
<p>A matmul kernel loads a tile of each input into shared memory, multiplies it many times from there, and writes the output tile once; FlashAttention applies the same idea to attention so the \(T\times T\) score matrix never reaches HBM. The roofline above says when this matters: below the ridge point, every avoided HBM byte is speed. <b>Triton</b> is a Python-embedded language for writing such kernels at the level of tiles ("blocks") rather than individual threads; its compiler handles thread mapping, memory coalescing and shared-memory staging, which is why research teams use it for custom fused kernels.</p>
</div>
'''

UNITS = r'''
<h3 id="sysdesign--units">Units and back-of-envelope maths</h3>
<p>Most estimation mistakes in design rounds are unit mistakes: bits for bytes, decimal for binary prefixes, per second for per day. This section is the habit that prevents them, then four worked scale-outs.</p>

<div class="layer eli5"><div class="lh"><span class="badge">Plain words</span><span class="lt">A bit is a single yes/no; a byte is eight of them</span></div>
  <p>A <b>bit</b> is the smallest unit of information: one 0 or 1. A <b>byte</b> is 8 bits, enough for one letter. Network speeds are advertised in bits per second (a "1 gig" home connection is 1 gigabit per second), while files and memory are measured in bytes. So a 1 Gb/s connection moves at most 125 megabytes per second, and a 1 GB file takes at least 8 seconds on it, not 1.</p>
</div>

<div class="layer lead"><div class="lh"><span class="badge">For leaders</span><span class="lt">Read every number with its unit</span></div>
  <p>Lowercase <b>b</b> is bits, uppercase <b>B</b> is bytes. Mb/s or Mbps is megabits per second; MB/s is megabytes per second. A design that confuses them is off by 8×, which is the difference between "fits on one NIC" and "needs eight". Ask for the arithmetic, not just the conclusion.</p>
</div>

<div class="layer deep"><div class="lh"><span class="badge">Under the hood</span><span class="lt">The conversion table</span></div>
<div class="tw"><table><thead><tr><th>Unit</th><th>Means</th><th>In bytes</th></tr></thead><tbody>
<tr><td>1 b (bit)</td><td>one binary digit</td><td class="n">1/8 B</td></tr>
<tr><td>1 B (byte)</td><td>8 bits</td><td class="n">1 B</td></tr>
<tr><td>1 KB / 1 MB / 1 GB / 1 TB / 1 PB (decimal, SI)</td><td>10³ / 10⁶ / 10⁹ / 10¹² / 10¹⁵ bytes</td><td>used for disks, network, cloud billing</td></tr>
<tr><td>1 KiB / 1 MiB / 1 GiB / 1 TiB (binary)</td><td>2¹⁰ / 2²⁰ / 2³⁰ / 2⁴⁰ bytes</td><td>used for RAM; 1 GiB = 1.074 GB, 1 TiB = 1.10 TB</td></tr>
<tr><td>1 Gb/s link</td><td>10⁹ bits per second</td><td class="n">125 MB/s</td></tr>
<tr><td>10 / 25 / 100 / 400 Gb/s</td><td>common NIC speeds</td><td class="n">1.25 / 3.1 / 12.5 / 50 GB/s</td></tr>
<tr><td>Usable fraction</td><td>protocol overhead, TCP, contention</td><td>plan for 70–90% of line rate</td></tr>
</tbody></table></div>
<div class="eq">\[ \text{time} = \frac{\text{bytes} \times 8}{\text{link in bits/s} \times \text{efficiency}}, \qquad \text{QPS}_\text{avg} = \frac{\text{events per day}}{86{,}400}, \qquad \text{QPS}_\text{peak} \approx 2\text{–}5 \times \text{QPS}_\text{avg} \]<span class="eqcap">Convert to one unit system first. 86,400 seconds per day ≈ 10⁵ is close enough for estimates: 1 million per day ≈ 12 per second.</span></div>
<p><b>Sizes worth memorising</b> (illustrative): a character of English text ≈ 1 byte; a token ≈ 4 characters; a tweet-sized message with metadata ≈ 300 bytes; a 512-dimensional float32 embedding = 2 KB; a 1080p frame uncompressed ≈ 6 MB; a minute of 1080p video ≈ 50–100 MB compressed; a model parameter in BF16 = 2 bytes, so 70B parameters = 140 GB.</p>
</div>

<div class="widget" id="w-sd-xfer">
  <div class="wtitle">How long does it take to move this?</div>
  <div class="wsub">Pick a size and a link. The widget converts bits and bytes for you and shows how many parallel links you need to hit a deadline.</div>
  <div class="controls">
    <div class="ctl"><label for="xf-size">Data size: <output id="xf-size-o">500 GB</output></label><input type="range" id="xf-size" min="0" max="12" step="1" value="8"></div>
    <div class="ctl"><label for="xf-link">Link</label><select id="xf-link"><option value="1e9">1 Gb/s</option><option value="1e10" selected>10 Gb/s</option><option value="2.5e10">25 Gb/s</option><option value="1e11">100 Gb/s</option><option value="4e11">400 Gb/s</option></select></div>
    <div class="ctl"><label for="xf-eff">Usable fraction: <output id="xf-eff-o">80%</output></label><input type="range" id="xf-eff" min="0.5" max="1" step="0.05" value="0.8"></div>
    <div class="ctl"><label for="xf-dl">Deadline</label><select id="xf-dl"><option value="60">1 minute</option><option value="600" selected>10 minutes</option><option value="3600">1 hour</option><option value="86400">1 day</option></select></div>
  </div>
  <div class="cards">
    <div class="mc"><div class="l">Link in bytes</div><div class="v" data-bps>—</div></div>
    <div class="mc"><div class="l">Time on one link</div><div class="v" data-t>—</div></div>
    <div class="mc"><div class="l">Links needed for the deadline</div><div class="v" data-n>—</div></div>
  </div>
  <div class="readout" data-out></div>
</div>

<h3>Scaling out, worked</h3>
<div class="callout example"><span class="tag">Worked problem</span><div>
<p><b>1. Photo uploads.</b> 10M uploads/day at 3 MB each. QPS ≈ 10⁷ ÷ 86,400 ≈ 116/s average, ~400/s peak. Ingress ≈ 400 × 3 MB = 1.2 GB/s = 9.6 Gb/s at peak: one 10 Gb/s link is not enough with headroom, so spread across several front ends. Storage: 30 TB/day, ×3 replication = 90 TB/day ≈ 33 PB/year; erasure coding (1.5× instead of 3×) cuts that to ≈ 16 PB/year.</p>
<p><b>2. Chat messages.</b> 100M users × 40 messages × 300 B = 1.2 TB/day; peak QPS ≈ 4B ÷ 86,400 × 3 ≈ 140K/s, but bandwidth is only 140K × 300 B = 42 MB/s ≈ 0.34 Gb/s. Bytes are not the problem; 30M open connections are.</p>
<p><b>3. Model weights to a fleet.</b> 140 GB (70B in BF16) to one server over 10 Gb/s at 80%: 140 × 8 ÷ 8 = 140 s. To 100 servers from one source: 14,000 s ≈ 3.9 h; with peer-to-peer copying the time stays near 2 × 140 s.</p>
<p><b>4. How many shards?</b> 5 TB of hot data, 200K reads/s, 20K writes/s. If one node holds 1 TB comfortably and serves 20K reads/s and 5K writes/s: storage needs 5 shards, reads 10 nodes, writes 4 primaries. The largest wins: 10 nodes (for example 5 shards × 2 replicas). Recompute at 3× growth before committing.</p>
</div></div>
<div class="callout warn"><span class="tag">Watch out</span><div>Three classic slips: using 1 GB/s for a "1 gig" link (it is 125 MB/s); forgetting replication when sizing storage; and sizing for the daily average instead of the peak hour.</div></div>
'''

insert_before_end('42-optimization.html', 'optimization--applied', OPT)
insert_before_end('22-classification.html', 'classification--ranking', RANK)
insert_before('35-assistant.html', '<details class="qa"><summary>Interview case: "Our Claude pilot', 'assistant--embeddings', EMB)
insert_before_end('51-inference.html', 'inference--gpu', GPU)
insert_before('92-sysdesign.html', '<h3>The method in six steps</h3>', 'sysdesign--units', UNITS)
