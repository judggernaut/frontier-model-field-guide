"""Worked ML-coding examples for Part VII. Snippets between '# >>> name' and '# <<<' appear in the guide.
Run: python3 tools/worked/ml.py"""
import numpy as np
import random
from collections import Counter, deque

# ============================================================ attention: v1 single head, v2 multi-head causal, v3 KV cache + GQA
# >>> attn_v1
import numpy as np

def softmax(s, axis=-1):
    s = s - s.max(axis, keepdims=True)          # subtract the max: exp never overflows
    e = np.exp(s); return e / e.sum(axis, keepdims=True)

def attention(Q, K, V, causal=True):
    """Q: (T, d), K, V: (S, d). Returns (T, d)."""
    s = Q @ K.T / np.sqrt(Q.shape[-1])          # scale keeps logits O(1) as d grows
    if causal:
        T, S = s.shape
        s = np.where(np.triu(np.ones((T, S), bool), k=S - T + 1), -np.inf, s)   # no peeking ahead
    return softmax(s) @ V
# <<<

# >>> attn_v2
def mha(X, Wq, Wk, Wv, Wo, h):
    T, d = X.shape; dh = d // h
    split = lambda A: A.reshape(T, h, dh).transpose(1, 0, 2)       # (h, T, dh)
    q, k, v = split(X @ Wq), split(X @ Wk), split(X @ Wv)
    o = np.stack([attention(q[i], k[i], v[i]) for i in range(h)])  # (h, T, dh)
    return o.transpose(1, 0, 2).reshape(T, d) @ Wo
# <<<

# >>> attn_v3
def decode_step(x, W, cache, n_q, n_kv):
    """One new token x: (d,). cache holds K, V of shape (n_kv, t, dh). GQA: each KV head serves n_q/n_kv query heads."""
    Wq, Wk, Wv, Wo = W
    d = x.shape[0]; dh = d // n_q; g = n_q // n_kv
    q = (x @ Wq).reshape(n_q, dh)
    k = (x @ Wk).reshape(n_kv, 1, dh); v = (x @ Wv).reshape(n_kv, 1, dh)
    cache["K"] = k if cache["K"] is None else np.concatenate([cache["K"], k], axis=1)   # append, never recompute
    cache["V"] = v if cache["V"] is None else np.concatenate([cache["V"], v], axis=1)
    K = np.repeat(cache["K"], g, axis=0); V = np.repeat(cache["V"], g, axis=0)          # (n_q, t, dh)
    p = softmax(np.einsum("hd,htd->ht", q, K) / np.sqrt(dh))
    return np.einsum("ht,htd->hd", p, V).reshape(d) @ Wo
# <<<

def _attn_tests():
    rng = np.random.default_rng(0); d, T = 16, 6
    X = rng.normal(size=(T, d)); Ws = [rng.normal(size=(d, d)) / 4 for _ in range(4)]
    y = mha(X, *Ws, h=4)
    assert np.allclose(mha(X[:3], *Ws, h=4), y[:3])                     # causal prefix property
    cache = {"K": None, "V": None}                                      # n_kv == n_q: plain MHA with cache
    steps = np.stack([decode_step(X[t], Ws, cache, 4, 4) for t in range(T)])
    assert np.allclose(steps, y)
    Wk2, Wv2 = rng.normal(size=(d, d // 2)) / 4, rng.normal(size=(d, d // 2)) / 4
    cache = {"K": None, "V": None}
    g = np.stack([decode_step(X[t], (Ws[0], Wk2, Wv2, Ws[3]), cache, 4, 2) for t in range(T)])
    assert g.shape == (T, d) and cache["K"].shape == (2, T, 4)

# ============================================================ sampling
# >>> samp_v1
def sample(logits, temperature=1.0, top_k=0, top_p=1.0, rng=np.random.default_rng()):
    if temperature == 0: return int(np.argmax(logits))       # greedy
    z = logits / temperature
    p = softmax(z)
    order = np.argsort(-p)
    if top_k: order = order[:top_k]
    if top_p < 1.0:
        cum = np.cumsum(p[order])
        order = order[: np.searchsorted(cum, top_p) + 1]     # smallest prefix with mass >= top_p
    q = p[order] / p[order].sum()                            # renormalise over what survived
    return int(order[rng.choice(len(order), p=q)])
# <<<

def _samp_tests():
    lg = np.array([5.0, 4.0, 0.0, -1.0]); r = np.random.default_rng(1)
    assert sample(lg, 0) == 0
    assert all(sample(lg, 1.0, top_p=0.9, rng=r) in (0, 1) for _ in range(200))
    assert all(sample(lg, 1.0, top_k=1, rng=r) == 0 for _ in range(20))

# ============================================================ nearest centroid / k-means
# >>> km_v1
def assign(X, C):
    """X: (N, D), C: (K, D) -> (N,) index of nearest centre. Memory O(N*K), not O(N*K*D)."""
    d2 = (X * X).sum(1)[:, None] - 2 * X @ C.T + (C * C).sum(1)[None, :]   # |x|^2 - 2 x.c + |c|^2
    return d2.argmin(1)
# <<<

# >>> km_v2
def kmeans(X, k, iters=100, seed=0):
    rng = np.random.default_rng(seed)
    C = X[[rng.integers(len(X))]]                         # k-means++: spread the starting centres
    for _ in range(1, k):
        d2 = ((X[:, None] - C[None]) ** 2).sum(-1).min(1)
        C = np.vstack([C, X[rng.choice(len(X), p=d2 / d2.sum())]])
    for _ in range(iters):
        lab = assign(X, C)
        newC = np.array([X[lab == j].mean(0) if (lab == j).any() else C[j] for j in range(k)])
        if np.allclose(newC, C): break
        C = newC
    return C, lab
# <<<

def _km_tests():
    rng = np.random.default_rng(0)
    X = np.vstack([rng.normal(0, .1, (50, 2)), rng.normal(5, .1, (50, 2))])
    C = np.array([[0., 0.], [5., 5.]])
    lab = assign(X, C); assert (lab[:50] == 0).all() and (lab[50:] == 1).all()
    brute = ((X[:, None] - C[None]) ** 2).sum(-1).argmin(1); assert (brute == lab).all()
    C2, l2 = kmeans(X, 2); assert len(set(l2[:50])) == 1 and l2[0] != l2[-1]

# ============================================================ GRPO
# >>> grpo_v1
def group_advantages(R, eps=1e-6, scale=True):
    """R: (P, G) rewards, G samples per prompt. Advantage = reward relative to the group."""
    A = R - R.mean(1, keepdims=True)
    if scale: A = A / (R.std(1, keepdims=True) + eps)   # Dr. GRPO sets scale=False
    return A
# <<<

# >>> grpo_v2
def grpo_loss(logp, logp_old, A, mask, clip=0.2, logp_ref=None, beta=0.0):
    """logp*: (P, G, L) token log-probs; A: (P, G); mask: (P, G, L) = 1 on response tokens."""
    ratio = np.exp(logp - logp_old)                       # importance weight per token
    a = A[..., None]
    obj = np.minimum(ratio * a, np.clip(ratio, 1 - clip, 1 + clip) * a)   # PPO clip
    if logp_ref is not None:                              # k3 KL estimator, per token
        r = np.exp(logp_ref - logp); obj = obj - beta * (r - (logp_ref - logp) - 1)
    per_seq = (obj * mask).sum(-1) / np.maximum(mask.sum(-1), 1)          # mean over each sequence
    return -per_seq.mean()
# <<<

# >>> grpo_v3
def shaped_reward(correct, n_tokens, step_scores=None, fmt_ok=True, max_len=4096):
    """Outcome reward gated so shaping cannot outweigh correctness."""
    r = 1.0 if correct else 0.0
    if not fmt_ok: return -1.0                              # unparsable answers are worse than wrong ones
    if correct: r -= 0.1 * max(0, n_tokens - max_len // 2) / (max_len // 2)   # mild length penalty, only when right
    if step_scores is not None:                             # process reward: average step score, small weight
        r += 0.2 * float(np.mean(step_scores))
    return r
# <<<

def _grpo_tests():
    R = np.array([[1., 0., 0., 1.], [1., 1., 1., 1.]])
    A = group_advantages(R); assert np.allclose(A[1], 0) and np.isclose(A[0].mean(), 0)
    rng = np.random.default_rng(0); lp = rng.normal(size=(2, 4, 5)); M = np.ones((2, 4, 5))
    assert np.isclose(grpo_loss(lp, lp, A, M), 0)
    hi = grpo_loss(lp + 1.0, lp, A, M)                     # ratio e > 1+clip: clipped for positive A
    assert np.isfinite(hi)
    assert shaped_reward(False, 10, fmt_ok=False) < shaped_reward(False, 10) < shaped_reward(True, 4000)

# ============================================================ speculative edits (xAI)
# >>> spec_v1
def greedy(model, prompt, max_new, eos):
    out = []
    for _ in range(max_new):
        out.append(model(prompt + out)[-1])                 # one forward pass per token
        if out[-1] == eos: break
    return out
# <<<

# >>> spec_v2
def speculative_edit(model, prompt, draft, max_new, eos, k=8):
    """model(seq) -> greedy next-token prediction at EVERY position of seq (one forward pass).
    Draft = the original file. Identical output to greedy, fewer passes when the edit is small."""
    out, passes, j = [], 0, 0                               # j: where we are in the draft
    while len(out) < max_new:
        prop = draft[j:j + k]
        preds = model(prompt + out + prop)[len(prompt) + len(out) - 1:]   # predictions for each proposed slot + 1
        passes += 1
        n = 0
        while n < len(prop) and preds[n] == prop[n]: n += 1               # longest agreeing prefix
        out += prop[:n] + [preds[n]]                                      # plus the model's own token
        j = realign(draft, out, j + n + 1)
        if eos in out: out = out[:out.index(eos) + 1]; break
    return out[:max_new], passes

def realign(draft, out, guess, n=3):
    """After a mismatch the edit may insert or delete: find the last n generated tokens in the draft."""
    tail = out[-n:]
    for start in range(max(0, guess - 32), min(len(draft), guess + 32)):
        if draft[start:start + len(tail)] == tail: return start + len(tail)
    return guess
# <<<

def _spec_tests():
    src = [1, 2, 3, 7, 4, 5, 6, 9, 8, 11, 12, 13]; EOS = 0
    target = [1, 2, 3, 70, 71, 4, 5, 6, 9, 8, 11, 12, 13, EOS]          # substitution + insertion
    def model(seq):
        return [target[i + 1] if i + 1 < len(target) else EOS for i in range(len(seq))]  # teacher-forced toy
    g = greedy(model, [target[0]], 30, EOS)
    s, passes = speculative_edit(model, [target[0]], src[1:], 30, EOS)
    assert g == s == target[1:], (g, s)
    assert passes < len(g), (passes, len(g))

# ============================================================ ranking / detection metrics
# >>> met_v1
def ndcg_at_k(rels_in_ranked_order, k):
    r = np.asarray(rels_in_ranked_order, float)
    disc = 1 / np.log2(np.arange(2, k + 2))
    dcg = ((2 ** r[:k] - 1) * disc[:len(r[:k])]).sum()
    ideal = np.sort(r)[::-1][:k]                          # best possible order of ALL items
    idcg = ((2 ** ideal - 1) * disc[:len(ideal)]).sum()
    return dcg / idcg if idcg > 0 else 0.0

def mrr(ranked_lists, relevant):
    rr = []
    for lst, rel in zip(ranked_lists, relevant):
        rr.append(next((1 / (i + 1) for i, x in enumerate(lst) if x in rel), 0.0))
    return float(np.mean(rr))

def recall_at_k(lst, rel, k): return len(set(lst[:k]) & rel) / len(rel)
# <<<

# >>> met_v2
def iou(a, b):
    """boxes (x1, y1, x2, y2), x2 > x1."""
    iw = max(0.0, min(a[2], b[2]) - max(a[0], b[0])); ih = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = iw * ih
    area = lambda r: (r[2] - r[0]) * (r[3] - r[1])
    return inter / (area(a) + area(b) - inter) if inter > 0 else 0.0

def average_precision(dets, gts, thr=0.5):
    """dets: [(score, box)], gts: [box] for ONE class in ONE image. Greedy matching by score."""
    dets = sorted(dets, key=lambda d: -d[0]); used = set(); tp = []
    for _, box in dets:
        best, bj = 0.0, None
        for j, g in enumerate(gts):
            if j not in used and iou(box, g) > best: best, bj = iou(box, g), j
        if best >= thr: used.add(bj); tp.append(1)
        else: tp.append(0)                                # a duplicate of a matched box is a false positive
    tp = np.array(tp, float); ctp = np.cumsum(tp); cfp = np.cumsum(1 - tp)
    prec = ctp / np.maximum(ctp + cfp, 1); rec = ctp / max(len(gts), 1)
    prec = np.maximum.accumulate(prec[::-1])[::-1]        # precision envelope
    return float(np.sum(np.diff(np.concatenate([[0], rec])) * prec))
# <<<

def _met_tests():
    assert np.isclose(ndcg_at_k([3, 2, 0], 3), 1.0) and ndcg_at_k([0, 2, 3], 3) < 1
    assert np.isclose(mrr([["a", "b"], ["c", "d", "e"]], [{"b"}, {"z"}]), 0.25)
    assert np.isclose(iou((0, 0, 2, 2), (1, 1, 3, 3)), 1 / 7)
    gts = [(0, 0, 10, 10), (20, 20, 30, 30)]
    dets = [(.9, (0, 0, 10, 10)), (.8, (0, 0, 10, 9)), (.7, (20, 20, 30, 31))]
    assert np.isclose(average_precision(dets, gts), 0.5 * 1 + 0.5 * (2 / 3))

# ============================================================ InfoNCE
# >>> nce_v1
def info_nce(Q, P, tau=0.05):
    """Q, P: (B, d) L2-normalised. Row i of P is query i's positive; the other rows are its negatives."""
    S = (Q @ P.T) / tau
    logp = S - S.max(1, keepdims=True)
    logp = logp - np.log(np.exp(logp).sum(1, keepdims=True))
    return -np.mean(np.diag(logp))                       # cross-entropy with label = own index
# <<<

def _nce_tests():
    rng = np.random.default_rng(0)
    Q = rng.normal(size=(8, 16)); Q /= np.linalg.norm(Q, axis=1, keepdims=True)
    assert info_nce(Q, Q) < info_nce(Q, Q[::-1])

# ============================================================ replay buffer bug hunt (Mistral)
# >>> rb_buggy
class ReplayBufferBuggy:
    def __init__(self, capacity, rng=random.Random()):
        self.capacity = capacity
        self.buf = []
        self.pos = 0
        self.rng = rng

    def add(self, s, a, r, s2, done):
        if len(self.buf) < self.capacity:
            self.buf.append((s, a, r, s2, done))
        else:
            self.buf[self.pos] = (s, a, r, s2, done)
        self.pos = self.pos + 1 % self.capacity                          # bug 1
    def sample(self, n):
        idx = [self.rng.randint(0, len(self.buf)) for _ in range(n)]     # bug 2
        return [self.buf[i] for i in idx]

    def latest(self):
        return self.buf[self.pos]                                        # bug 3

    def __len__(self):
        return self.capacity                                             # bug 4
# <<<

# >>> rb_fixed
class ReplayBuffer:
    def __init__(self, capacity, rng=None):
        if capacity <= 0: raise ValueError("capacity must be positive")
        self.capacity, self.buf, self.pos = capacity, [], 0
        self.rng = rng or random.Random()               # no shared default instance across buffers

    def add(self, s, a, r, s2, done):
        item = (s, a, r, s2, bool(done))
        if len(self.buf) < self.capacity: self.buf.append(item)
        else: self.buf[self.pos] = item
        self.pos = (self.pos + 1) % self.capacity       # precedence: % binds tighter than +

    def sample(self, n):
        if n > len(self.buf): raise ValueError("not enough transitions")
        return self.rng.sample(self.buf, n)             # without replacement; randint(0, len) overflowed

    def latest(self):
        if not self.buf: raise IndexError("empty")
        return self.buf[(self.pos - 1) % len(self.buf)] if len(self.buf) == self.capacity else self.buf[-1]

    def __len__(self): return len(self.buf)
# <<<

def _rb_tests():
    b = ReplayBuffer(3, random.Random(0))
    for i in range(5): b.add(i, 0, 0.0, i + 1, False)
    assert len(b) == 3 and b.latest()[0] == 4 and sorted(x[0] for x in b.buf) == [2, 3, 4]
    assert len(b.sample(3)) == 3
    b2 = ReplayBuffer(5); b2.add(1, 0, 0, 2, 0); assert b2.latest()[0] == 1 and len(b2) == 1

# ============================================================ mutual friends (Fireworks)
# >>> fof_v1
from collections import Counter

def recommend(graph, user, k=10):
    """graph: {user: set(friends)}, undirected. Score = mutual friends / (friends of user), in [0, 1]."""
    mine = graph.get(user, set())
    if not mine: return []                               # cold start: fall back to popularity elsewhere
    c = Counter()
    for f in mine:
        for ff in graph.get(f, ()):
            if ff != user and ff not in mine: c[ff] += 1
    ranked = sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))[:k]
    return [(u, m / len(mine)) for u, m in ranked]
# <<<

def _fof_tests():
    g = {"a": {"b", "c"}, "b": {"a", "d", "e"}, "c": {"a", "d"}, "d": {"b", "c"}, "e": {"b"}}
    assert recommend(g, "a") == [("d", 1.0), ("e", 0.5)]
    assert recommend(g, "zz") == []

# ============================================================ biased coin
# >>> coin_v1
def fair_bit(flip):
    while True:
        a, b = flip(), flip()
        if a != b: return a            # P(HT) = P(TH) = p(1-p): equal, whatever p is

def uniform_int(n, fair):
    """Uniform in [0, n) from fair bits by rejection: draw ceil(log2 n) bits, retry if >= n."""
    bits = max(1, (n - 1).bit_length())
    while True:
        x = 0
        for _ in range(bits): x = 2 * x + fair()
        if x < n: return x             # the bug to spot: 'return x % n' biases toward small values
# <<<

def _coin_tests():
    r = random.Random(0); flip = lambda: int(r.random() < 0.8)
    fb = lambda: fair_bit(flip)
    m = sum(fb() for _ in range(20000)) / 20000; assert abs(m - .5) < .02
    c = Counter(uniform_int(6, fb) for _ in range(12000)); assert all(abs(v / 12000 - 1 / 6) < .02 for v in c.values())

if __name__ == '__main__':
    for f in [_attn_tests, _samp_tests, _km_tests, _grpo_tests, _spec_tests, _met_tests, _nce_tests, _rb_tests, _fof_tests, _coin_tests]:
        f(); print('ok', f.__name__)
