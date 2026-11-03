"""Chapter 88: ML and LLM coding rounds, fully worked."""

INTRO = '''<p>Research, applied-scientist and MLE loops now ask you to write the pieces of an LLM system in NumPy: attention with a KV cache, sampling, GRPO, speculative decoding, metrics, contrastive losses. Each problem is worked with the questions to ask, the options, a versioned build, edge cases and the follow-ups that were reported. Tests live in <code>tools/worked/ml.py</code>. The concepts behind each are in the public guide; links point there.</p>
<div class="layer eli5"><div class="lh"><span class="badge">Plain words</span><span class="lt">Say the shapes before you write the code</span></div>
<p>Most bugs in these rounds are shape bugs. Before writing a line, say the shape of every array ("queries are T by d, scores are T by T") and check it after each step. Interviewers grade that habit as much as the final answer.</p></div>'''

EX = []

EX.append(dict(id='ml-attn', title='Attention, multi-head, then a KV cache with grouped-query attention',
 source='Amazon AGI applied scientist onsite; Meta MSL and Scale AI NumPy rounds; 2026.',
 prompt='Implement scaled dot-product attention, then multi-head causal attention, then a single decode step that appends to a KV cache, then make the cache grouped-query (fewer KV heads than query heads).',
 say='"Shapes first: X is T by d; with h heads each head has d/h dimensions. Scores are T by T per head, scaled by √dₕ, causal-masked, softmaxed along keys. The cache stores keys and values per KV head so each new token costs one row, not a recompute."',
 ask=[('Causal (decoder) or bidirectional?', 'Mask or no mask.'), ('Batch dimension needed?', 'Add a leading B; einsum keeps it readable.'), ('Padding masks?', 'Combine with the causal mask: −∞ on padded keys.'),
      ('GQA ratio: n_q divisible by n_kv?', 'Required; each KV head serves g = n_q / n_kv query heads.'), ('Numerical precision?', 'Subtract the row max before exp; in fp16 compute softmax in fp32.')],
 approaches=[('Loop over heads', 'Readable.', 'Slower; fine in NumPy interviews.'), ('Batched einsum over heads', 'Fast, compact.', 'Easy to transpose wrongly: state shapes.'), ('Repeat KV heads (np.repeat) for GQA', 'Simple.', 'Materialises copies; real kernels index instead.')],
 verdict='Readable loop for MHA, einsum for the decode step; mention that production kernels never materialise repeated KV heads.',
 steps=[('Scaled dot-product attention', 'The mask uses an offset so it also works when queries are the last T of S keys (the decode case).', 'attn_v1'),
        ('Multi-head', 'Split d into h heads, attend per head, concatenate, project. Test: with a causal mask, output for the first 3 tokens equals running on only those 3.', 'attn_v2'),
        ('Decode step with KV cache and GQA', 'Append this token\'s K and V; repeat KV heads g times; attend one query row per head. Test: running step by step equals the full causal pass (with n_kv = n_q).', 'attn_v3')],
 edges=[('T = 1', 'Mask is empty; still works.'), ('Very large logits', 'Max subtraction.'), ('Cache growth', 'Preallocate (n_kv, T_max, dₕ) and write in place; concatenation is O(t) per step.'), ('Padding inside a batch', 'Key mask, and ignore padded query rows in the loss.')],
 complexity='Full pass O(T²·d) time, O(h·T²) memory for scores. Decode step O(t·d) per token. KV cache bytes per token = 2 × layers × n_kv × dₕ × bytes per value.',
 followups=[('Why scale by √dₕ?', 'Dot products of random d-dimensional vectors have variance d; scaling keeps logits O(1) so softmax is not saturated at initialisation.'),
            ('FlashAttention?', 'Same result computed tile by tile in on-chip memory with an online softmax; fewer HBM reads, not fewer FLOPs.'),
            ('Why GQA?', 'Cuts KV cache memory and bandwidth by n_q / n_kv (8× for 64 query heads and 8 KV heads) for a small quality cost.')]))

EX.append(dict(id='ml-samp', title='Sampling: greedy, temperature, top-k, top-p',
 source='Scale AI senior MLE NumPy round; common follow-up in LLM screens.',
 prompt='Given logits for the next token, implement greedy, temperature, top-k and nucleus (top-p) sampling.',
 say='"Temperature divides logits; top-k keeps the k most likely; top-p keeps the smallest set whose probability mass reaches p; then renormalise and sample."',
 ask=[('Apply top-k and top-p together? In which order?', 'Common order: temperature, then top-k, then top-p.'), ('Temperature 0?', 'Treat as greedy; dividing by zero is the bug.'), ('Batch?', 'Vectorise per row; sorting is per row.')],
 approaches=[('Sort probabilities', 'Clear.', 'O(V log V) per step.'), ('argpartition for top-k', 'O(V).', 'Top-p still needs a sort of the candidates.')],
 verdict='Sort-based, with argpartition mentioned for speed.',
 steps=[('All four in one function', 'Note the inclusive boundary: <code>searchsorted(cum, p) + 1</code> keeps the token that crosses p.', 'samp_v1')],
 edges=[('p so small that nothing survives', 'Always keep at least the top token (the +1 does).'), ('Ties at the cutoff', 'Deterministic by sort order; fine.'), ('NaN logits', 'Validate upstream.')],
 complexity='O(V log V) per token.',
 followups=[('Why does top-p behave better than top-k?', 'The kept set adapts to the distribution: few tokens when confident, many when uncertain.'),
            ('min-p?', 'Keep tokens with p ≥ min_p × p_max; scales the cutoff with confidence.')]))

EX.append(dict(id='ml-km', title='Nearest centre assignment, then k-means',
 source='Mistral senior staff research scientist coding round ("AI coding"); Meta research scientist coding; 2026.',
 prompt='Given points X (N × D) and centres C (K × D), return each point\'s nearest centre by L2 distance, vectorised. Then implement k-means.',
 say='"The naive broadcast builds an N×K×D array. Expanding |x − c|² = |x|² − 2x·c + |c|² needs only an N×K matrix multiply, which is how you would do it at scale."',
 ask=[('Sizes of N, K, D?', 'N·K·D floats may not fit in memory: use the expansion or chunk over N.'), ('Ties?', 'argmin returns the first.'), ('k-means: initialisation, stopping rule, empty clusters?', 'k-means++; stop when centres stop moving; keep the old centre for an empty cluster (or re-seed).')],
 approaches=[('Broadcast difference', 'Obvious.', 'O(N·K·D) memory.'), ('Norm expansion + matmul', 'O(N·K) memory; uses BLAS.', 'Can go slightly negative from rounding: clamp at 0 if you need distances.'), ('Chunk over N', 'Bounded memory.', 'A loop.')],
 verdict='Norm expansion, mention chunking.',
 steps=[('Vectorised assignment', '', 'km_v1'), ('k-means with k-means++', 'Assign, recompute means, repeat until stable.', 'km_v2')],
 edges=[('Empty cluster', 'Keep the previous centre or re-seed from the farthest point.'), ('Duplicate points as seeds', 'k-means++ assigns them zero probability.'), ('Float rounding', 'Clamp negative squared distances to 0.')],
 complexity='Assignment O(N·K·D) FLOPs, O(N·K) memory. k-means O(iterations × N·K·D).',
 followups=[('k-means vs a Gaussian mixture?', 'Hard vs soft assignment; spherical equal clusters vs full covariances; GMM is fitted by EM and k-means is its zero-variance limit.')]))

EX.append(dict(id='ml-grpo', title='GRPO in NumPy, with process and shaped rewards',
 source='Amazon AGI applied scientist notebook round, 2026.',
 prompt='Given rewards for G samples per prompt and per-token log-probabilities under the new, old and reference policies, compute group advantages and the GRPO loss. Then add a process reward and a shaped (format/length) reward.',
 say='"The group is the baseline: advantage is each sample\'s reward minus the group mean, optionally divided by the group std. The loss is PPO\'s clipped objective with that advantage on every response token, averaged per sequence, plus an optional KL to the reference."',
 ask=[('Normalise by group std or not?', 'Std normalisation up-weights very easy and very hard prompts (Dr. GRPO removes it).'), ('Per-sequence or per-token averaging?', 'Per-sequence averaging favours long wrong answers; DAPO uses token-level averaging.'),
      ('KL in the loss or in the reward? Which estimator?', 'GRPO puts a k3 estimator in the loss.'), ('How are process rewards given: per step or summed?', 'Per-step rewards can be assigned to the tokens of each step, or averaged into the outcome.')],
 approaches=[('Outcome reward only', 'Simple, robust.', 'Sparse: no signal when all G samples fail.'), ('Outcome + process reward', 'Denser credit.', 'Process model can be gamed; weight it low.'), ('Shaping terms (format, length)', 'Fix specific failures.', 'Easily dominate correctness: gate them.')],
 verdict='Outcome reward with gated shaping and a small process term; std normalisation discussed as a choice.',
 steps=[('Advantages', 'Zero advantage for groups where every sample scored the same: those prompts carry no gradient, so filter them.', 'grpo_v1'),
        ('Clipped loss with KL', 'Importance ratio per token, clipped; mask non-response tokens; average per sequence.', 'grpo_v2'),
        ('Reward shaping and process rewards', 'Format failures score below wrong answers; length penalty only when correct; process reward small.', 'grpo_v3')],
 edges=[('All rewards equal in a group', 'Advantage 0 (and std 0: the eps prevents division by zero).'), ('Empty response', 'Mask sum 0: guard the division.'), ('Ratio explodes', 'Clipping bounds the update; log-probs mismatched between engine and trainer show up here first.')],
 complexity='O(P·G·L) per batch.',
 followups=[('Why does GRPO not need a value model?', 'The group mean is the baseline; it costs G samples per prompt instead of a critic network.'),
            ('Where does reward hacking show up?', 'Rising reward with rising length or format tricks; read the top-reward samples.')]))

EX.append(dict(id='ml-spec', title='Greedy decoding, then speculative edits',
 source='xAI senior MLE ML-coding round, 2026.',
 prompt='Implement greedy decoding. Then implement "speculative edits": for a code-editing request, use the original file as the draft, verify several draft tokens per model call, and produce exactly the greedy output with fewer calls.',
 say='"Greedy is one forward pass per token. With a draft, one pass scores all k proposed tokens at once; I accept the longest prefix where the model\'s own greedy choice equals the draft, then append the model\'s token at the first mismatch. The output is identical to greedy by construction."',
 ask=[('Model interface: one call returns predictions for every position?', 'That is what makes verifying k tokens one call.'), ('Draft length k?', 'Longer drafts help when edits are rare; wasted compute when they are not.'),
      ('Edits include insertions and deletions?', 'Then the draft pointer must re-align after a mismatch.'), ('Greedy or sampling?', 'Sampling needs the accept/reject rule of speculative decoding to keep the distribution exact.')],
 approaches=[('Greedy', 'Baseline.', 'One pass per token.'), ('Draft = original file, fixed offset', 'Simple.', 'Breaks after the first insertion.'), ('Draft = original file + n-gram re-alignment', 'Handles insertions and deletions (prompt-lookup decoding).', 'Re-alignment heuristic.'), ('Small draft model', 'General.', 'A second model to run.')],
 verdict='File-as-draft with n-gram re-alignment.',
 steps=[('Greedy baseline', '', 'spec_v1'),
        ('Speculative edits', 'Score the k proposed tokens in one pass; accept the agreeing prefix plus one model token; re-align the draft by finding the last few generated tokens in it. Test against greedy on an edit that substitutes and inserts.', 'spec_v2')],
 edges=[('Draft exhausted', 'Proposal empty: one model token per pass (plain greedy).'), ('EOS inside accepted tokens', 'Truncate after it.'), ('Repeated n-grams in the draft', 'Search near the expected position first.')],
 complexity='Passes ≈ output length ÷ (accepted tokens per pass + 1). With a few edits in a 1,000-token file and k = 16, roughly 60–100 passes instead of 1,000.',
 followups=[('Why is the output identical?', 'Every emitted token is the model\'s greedy choice given the true prefix: accepted draft tokens matched it, and the extra token is the model\'s own.'),
            ('Cost of a rejected draft?', 'The pass still yields one correct token, so the worst case equals greedy plus the extra compute of scoring k tokens.')]))

EX.append(dict(id='ml-met', title='Ranking and detection metrics: NDCG, MRR, recall@k, IoU, average precision',
 source='Fireworks AI MLE (NDCG), Apple MLE ("Python coding" was IoU and mAP), RAG design rounds, 2026.',
 prompt='Implement NDCG@k, MRR and recall@k for ranked results; IoU for boxes; average precision for one class.',
 say='"For ranking: relevance discounted by log position, normalised by the ideal ordering. For detection: match predictions to ground truth by IoU above a threshold, in score order, then area under the precision envelope."',
 ask=[('Graded or binary relevance?', 'NDCG uses grades; MRR and recall use binary.'), ('Ideal DCG over the returned list or over all relevant items?', 'Over all known relevant items, or NDCG is inflated.'), ('Box format (x1,y1,x2,y2) or (x,y,w,h)?', 'Convert first.'), ('IoU threshold; one class or many; COCO or VOC AP?', 'COCO averages AP over thresholds 0.5–0.95.')],
 approaches=[('Direct formulas', 'Clear.', '—'), ('Library (sklearn ndcg_score, pycocotools)', 'Trusted.', 'Not allowed in the round.')],
 verdict='Direct formulas, with the ideal computed from all relevant items.',
 steps=[('Ranking metrics', '', 'met_v1'), ('IoU and AP', 'Greedy matching in score order; a second box on an already-matched object is a false positive.', 'met_v2')],
 edges=[('No relevant items', 'IDCG 0: return 0 (or exclude the query).'), ('Zero-area boxes', 'IoU 0.'), ('No detections', 'AP 0.'), ('Duplicates', 'False positives.')],
 complexity='Ranking O(n log n); AP O(D·G) for matching.',
 followups=[('Offline NDCG went up; ship it?', 'Check online metrics in an A/B test, segment regressions and latency first (public guide, A/B tests).')]))

EX.append(dict(id='ml-nce', title='Contrastive loss for retrieval embeddings (InfoNCE)',
 source='RAG system design deep dives at several labs, 2026.',
 prompt='Write the InfoNCE loss with in-batch negatives, then discuss hard negatives and temperature.',
 say='"Each query should score its own positive higher than every other passage in the batch: a cross-entropy over the similarity row with the label on the diagonal."',
 ask=[('Symmetric loss (query→passage and passage→query)?', 'CLIP-style averages both directions.'), ('Batch size?', 'More negatives per step; memory grows.'), ('Hard negatives available?', 'Add them as extra columns.')],
 approaches=[('In-batch negatives only', 'Free.', 'Mostly easy negatives.'), ('Mined hard negatives', 'Much stronger signal.', 'Many "negatives" are unlabelled positives: filter with a cross-encoder.')],
 verdict='In-batch plus filtered hard negatives.',
 steps=[('The loss', 'Normalise, divide by temperature, cross-entropy on the diagonal.', 'nce_v1')],
 edges=[('Duplicate passages in a batch', 'False negatives: deduplicate or mask.'), ('Temperature too low', 'Unstable gradients.')],
 complexity='O(B²·d) per batch.',
 followups=[('How do you evaluate the new embeddings?', 'Recall@k and MRR on held-out queries, before and after, plus end-to-end answer quality.')]))

EX.append(dict(id='ml-rb', title='Code review: a buggy replay buffer',
 source='Mistral senior staff research scientist, final round ("eight issues"), 2026.',
 prompt='Here is a replay buffer class used in RL training. Its tests pass on small cases. Find and fix the bugs.',
 say='"I\'ll read each method for its contract, then check boundaries: empty, exactly full, wrapped around. Precedence, off-by-one in random ranges, and mutable defaults are the usual suspects."',
 ask=[('Sampling with or without replacement?', 'Changes the fix for <code>sample</code>.'), ('What should <code>latest</code> return after wrap-around?', 'The most recently added item, not the next slot to overwrite.'), ('Thread safety needed?', 'Add a lock if actors write while the learner samples.')],
 approaches=[('Read top to bottom', 'Finds syntax-level bugs.', 'Misses state bugs.'), ('Check each method at empty / full / wrapped', 'Finds the real bugs.', 'Takes a few minutes.')],
 verdict='Contract per method, then boundary walk.',
 steps=[('The buggy code', 'Five planted bugs: <code>+</code> binds weaker than <code>%</code>; <code>randint</code> is inclusive so index len(buf) can be drawn; <code>latest</code> returns the slot about to be overwritten; <code>__len__</code> lies; a shared default RNG instance across buffers.', 'rb_buggy'),
        ('Fixed', 'Plus validation of capacity and sample size.', 'rb_fixed')],
 edges=[('Sample before enough data', 'Raise (or block).'), ('Capacity 0', 'Raise.'), ('Exactly full, not wrapped', '<code>latest</code> is the last element.')],
 complexity='add O(1), sample O(n).',
 followups=[('Prioritised replay?', 'A sum-tree for O(log n) sampling by priority, with importance weights to correct the bias.')]))

EX.append(dict(id='ml-fof', title='Friend recommendations from mutual friends',
 source='Fireworks AI applied MLE, AI-assisted coding round, 2026.',
 prompt='Given an undirected friendship graph, recommend non-friends with at least one mutual friend. Then give each a score bounded in [0, 1]. Discuss evaluation with NDCG.',
 say='"Two hops: count friends-of-friends who are not me and not already friends. Score = mutual friends ÷ my friend count is in [0, 1]. Evaluate offline by hiding some real new friendships and measuring NDCG of the ranking."',
 ask=[('Graph size and degree?', 'High-degree users make two-hop expansion expensive: sample or cap.'), ('Score semantics?', 'Normalised mutual count; Jaccard and Adamic–Adar are alternatives.'), ('Evaluation data?', 'Time split: edges formed after a cutoff are the positives.')],
 approaches=[('Mutual-friend count', 'Simple, strong baseline.', 'Favours popular users.'), ('Adamic–Adar', 'Down-weights mutuals who are friends with everyone.', 'Less interpretable.'), ('Learned ranker', 'Best quality.', 'Needs features and labels.')],
 verdict='Mutual count with a bounded score; mention Adamic–Adar.',
 steps=[('Two-hop counting', '', 'fof_v1')],
 edges=[('User with no friends', 'Cold start: popular or nearby users.'), ('Self and existing friends', 'Excluded.'), ('Celebrity hubs', 'Cap expansion per hub.')],
 complexity='O(Σ over friends of their degree).',
 followups=[('Why NDCG?', 'It rewards putting the friendships that actually form near the top, with graded relevance if you have it (accepted vs viewed).')]))

EX.append(dict(id='ml-coin', title='Biased coin to fair coin, uniform integers, then Monte Carlo in parallel',
 source='Anthropic new coding question, 2026.',
 prompt='Make a fair bit from a coin with unknown bias. Find the bug in a provided uniform-random-integer function. Estimate a quantity by simulation, then parallelise it.',
 say='"Flip twice; HT and TH are equally likely whatever the bias, so return the first flip and retry on HH or TT. For uniform integers, modulo is biased; rejection sampling is not."',
 ask=[('Expected cost?', '1 / (p(1 − p)) flips per fair bit: 6.25 at p = 0.8.'), ('Parallel: threads or processes?', 'CPU-bound Python: processes; one seeded generator per worker.')],
 approaches=[('Von Neumann extractor', 'Simple, exact.', 'Wastes flips when p is far from 0.5.'), ('Iterated extractors (Peres)', 'Near-optimal efficiency.', 'More complex.')],
 verdict='Von Neumann; mention Peres if asked to improve efficiency.',
 steps=[('Fair bits and uniform integers', 'The provided bug is <code>x % n</code>: with 3 bits and n = 6, values 0 and 1 appear twice as often.', 'coin_v1'),
        ('Parallel Monte Carlo', 'Split trials across processes, give each its own seed, sum counts. Never share one generator across threads.', None)],
 edges=[('p = 0 or 1', 'Never terminates: detect and raise after many tries.'), ('n = 1', 'Always 0.')],
 complexity='Expected 2 / (2p(1 − p)) flips per bit.',
 followups=[('Standard error of the estimate?', '√(p̂(1 − p̂)/n): quadruple the trials to halve it.')]))

SNIPS = ('ml.py',)
META = ('ml-coding', 'ML coding rounds', 'ML and LLM coding rounds: ten problems, fully worked')
