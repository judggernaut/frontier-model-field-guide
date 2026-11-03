"""Worked coding examples for Part VII. Every snippet between '# >>> name' and '# <<<' is shown in the guide.
Run: python3 tools/worked/swe.py   (all tests must pass before regenerating chapters)"""
import heapq, itertools, json, os, threading, queue, bisect
from collections import Counter, OrderedDict, defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, FIRST_COMPLETED, wait
from urllib.parse import urlsplit, urlunsplit

# ============================================================ 1. crawler
# >>> crawl_v1
from urllib.parse import urlsplit, urlunsplit
from collections import deque

def norm(url):
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, p.path, p.query, ''))   # drop the #fragment only

def crawl_v1(start, get_urls):
    start = norm(start); host = urlsplit(start).hostname
    seen, todo = {start}, deque([start])
    while todo:
        url = todo.popleft()
        for raw in get_urls(url):
            u = norm(raw)
            if urlsplit(u).hostname == host and u not in seen:   # exact host, not endswith
                seen.add(u); todo.append(u)
    return sorted(seen)
# <<<

# >>> crawl_v2
from concurrent.futures import ThreadPoolExecutor, FIRST_COMPLETED, wait

def crawl_v2(start, get_urls, workers=8):
    start = norm(start); host = urlsplit(start).hostname
    seen = {start}                                   # owned by this thread only: no lock needed
    with ThreadPoolExecutor(workers) as pool:
        pending = {pool.submit(get_urls, start)}
        while pending:                               # empty = nothing in flight, nothing queued
            done, pending = wait(pending, return_when=FIRST_COMPLETED)
            for f in done:
                try: links = f.result()
                except Exception: continue           # one bad page must not kill the crawl
                for raw in links:
                    u = norm(raw)
                    if urlsplit(u).hostname == host and u not in seen:
                        seen.add(u)                  # mark BEFORE submit: never fetched twice
                        pending.add(pool.submit(get_urls, u))
    return sorted(seen)
# <<<

# >>> crawl_v3
import threading, queue

def crawl_v3(start, get_urls, n=8):
    """Workers enqueue their own discoveries: the shared set needs a lock, termination needs a count."""
    start = norm(start); host = urlsplit(start).hostname
    seen, lock, q = {start}, threading.Lock(), queue.Queue()
    q.put(start)
    def worker():
        while True:
            url = q.get()
            if url is None: return
            try:
                for raw in get_urls(url):
                    u = norm(raw)
                    if urlsplit(u).hostname != host: continue
                    with lock:                       # check-and-insert as ONE atomic step
                        if u in seen: continue
                        seen.add(u)
                    q.put(u)
            except Exception:
                pass
            finally:
                q.task_done()                        # join() waits until every put is done
    ts = [threading.Thread(target=worker, daemon=True) for _ in range(n)]
    for t in ts: t.start()
    q.join()
    for _ in ts: q.put(None)                         # poison pills
    for t in ts: t.join()
    return sorted(seen)
# <<<

def _crawl_tests():
    g = {"http://alpha.com/start": ["http://alpha.com/docs", "http://alpha.com/blog#intro", "http://sub.alpha.com/x"],
         "http://alpha.com/docs": ["http://beta.com/profile#top", "http://alpha.com/start#top"],
         "http://alpha.com/blog": ["http://alpha.com/start", "http://alpha.com/broken"]}
    def get(u):
        if u.endswith('broken'): raise IOError('500')
        return g.get(u, [])
    exp = ['http://alpha.com/blog', 'http://alpha.com/broken', 'http://alpha.com/docs', 'http://alpha.com/start']
    assert crawl_v2("http://alpha.com/start", get) == exp
    assert crawl_v3("http://alpha.com/start", get) == exp
    g2 = dict(g); g2["http://alpha.com/blog"] = ["http://alpha.com/start"]
    assert crawl_v1("http://alpha.com/start", lambda u: g2.get(u, [])) == exp[:1] + exp[2:]

# ============================================================ 2. work queue
# >>> wq_v1
import heapq, itertools

class WorkQueue:
    """States: ready -> running -> done | ready (retry) | dead (DLQ)."""
    def __init__(self, max_attempts=3):
        self.max_attempts, self.seq = max_attempts, itertools.count()
        self.ready, self.jobs, self.dlq = [], {}, []    # ready: heap of (first-enqueue order, id)

    def enqueue(self, jid):
        if jid in self.jobs: return                      # idempotent enqueue
        self.jobs[jid] = dict(state="ready", attempts=0, deadline=None, t0=next(self.seq))
        heapq.heappush(self.ready, (self.jobs[jid]["t0"], jid))

    def reserve(self, now, timeout):
        self._expire(now)
        while self.ready:
            _, jid = heapq.heappop(self.ready)
            j = self.jobs[jid]
            if j["state"] != "ready": continue            # stale heap entry (lazy deletion)
            j.update(state="running", deadline=now + timeout); j["attempts"] += 1
            return jid
        return None

    def complete(self, jid):
        if self.jobs[jid]["state"] == "running": self.jobs[jid]["state"] = "done"

    def fail(self, jid):
        if self.jobs[jid]["state"] == "running": self._retry(jid)

    def _retry(self, jid):
        j = self.jobs[jid]
        if j["attempts"] >= self.max_attempts:
            j["state"] = "dead"; self.dlq.append(jid)
        else:                                             # same t0: keeps its place in line
            j["state"] = "ready"; heapq.heappush(self.ready, (j["t0"], jid))

    def _expire(self, now):
        for jid, j in self.jobs.items():
            if j["state"] == "running" and now >= j["deadline"]: self._retry(jid)
# <<<

# >>> wq_v2
class DepQueue(WorkQueue):
    """A job is runnable once every dependency is done or dead. Unknown deps are allowed (may arrive later)."""
    def __init__(self, max_attempts=3):
        super().__init__(max_attempts)
        self.deps, self.waiting = {}, {}                  # id -> deps; id -> deps still unfinished

    def enqueue(self, jid, deps=()):
        if self._creates_cycle(jid, deps): raise ValueError(f"cycle through {jid}")
        self.deps[jid] = list(deps)
        open_deps = {d for d in deps if self.jobs.get(d, {}).get("state") not in ("done", "dead")}
        if open_deps:
            self.waiting[jid] = open_deps
            self.jobs[jid] = dict(state="blocked", attempts=0, deadline=None, t0=next(self.seq))
        else:
            super().enqueue(jid)

    def _creates_cycle(self, new, deps):
        stack, seen = list(deps), set()
        while stack:
            d = stack.pop()
            if d == new: return True
            if d not in seen: seen.add(d); stack.extend(self.deps.get(d, []))
        return False

    def _finished(self, jid):                             # unblock dependants
        for w, open_deps in list(self.waiting.items()):
            open_deps.discard(jid)
            if not open_deps:
                del self.waiting[w]; self.jobs[w]["state"] = "ready"
                heapq.heappush(self.ready, (self.jobs[w]["t0"], w))

    def complete(self, jid):
        super().complete(jid); self._finished(jid)

    def _retry(self, jid):
        super()._retry(jid)
        if self.jobs[jid]["state"] == "dead": self._finished(jid)
# <<<

def _wq_tests():
    q = WorkQueue(max_attempts=2)
    q.enqueue("a"); q.enqueue("b"); q.enqueue("a")
    assert q.reserve(0, 10) == "a"
    assert q.reserve(11, 10) == "a"          # timed out at 10, keeps its place ahead of b
    q.complete("a") if False else q.fail("a"); assert q.dlq == ["a"]
    assert q.reserve(12, 10) == "b"; q.complete("b"); q.complete("b")
    assert q.reserve(13, 10) is None
    d = DepQueue(max_attempts=1)
    d.enqueue("c", deps=["a", "b"]); d.enqueue("a"); d.enqueue("b", deps=["a"])
    try: d.enqueue("a2", deps=["c"]); d.enqueue("x", deps=["x"]); assert False
    except ValueError: pass
    assert d.reserve(0, 5) == "a"; d.complete("a")
    assert d.reserve(1, 5) == "b"; d.fail("b")       # b dead -> c unblocked
    assert d.reserve(2, 5) == "c"

# ============================================================ 3. durable LRU
# >>> lru_v1
from collections import OrderedDict

class LRU:
    def __init__(self, cap):
        self.cap, self.d = cap, OrderedDict()            # order = recency, oldest first
    def get(self, k):
        if k not in self.d: return None
        self.d.move_to_end(k); return self.d[k]
    def put(self, k, v):
        self.d[k] = v; self.d.move_to_end(k)
        if len(self.d) > self.cap: self.d.popitem(last=False)
# <<<

# >>> lru_v2
import json, os

class DurableLRU(LRU):
    """Write-ahead log: make each operation durable, then apply it. Recovery = replay."""
    def __init__(self, cap, path, fsync_every=1):
        super().__init__(cap)
        self.path, self.fsync_every, self.n = path, fsync_every, 0
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    try: op = json.loads(line)
                    except json.JSONDecodeError: break   # torn final line after a crash
                    self._apply(op)
        self.log = open(path, "a")

    def _apply(self, op):
        if op[0] == "put": LRU.put(self, op[1], op[2])
        elif op[0] == "get": LRU.get(self, op[1])         # recency is state: replay it too

    def _write(self, op):
        self.log.write(json.dumps(op) + "\n"); self.n += 1
        if self.n % self.fsync_every == 0:               # group commit: trade durability window for speed
            self.log.flush(); os.fsync(self.log.fileno())
        self._apply(op)

    def get(self, k):
        if k not in self.d: return None                  # misses change nothing: not logged
        self._write(["get", k]); return self.d[k]

    def put(self, k, v): self._write(["put", k, v])

    def compact(self):                                   # bound the log: snapshot + atomic rename
        tmp = self.path + ".tmp"
        with open(tmp, "w") as f:
            for k, v in self.d.items(): f.write(json.dumps(["put", k, v]) + "\n")
            f.flush(); os.fsync(f.fileno())
        self.log.close(); os.replace(tmp, self.path); self.log = open(self.path, "a")
# <<<

def _lru_tests():
    p = "/tmp/_wlru.log"
    if os.path.exists(p): os.remove(p)
    c = DurableLRU(2, p); c.put("a", 1); c.put("b", 2); c.get("a"); c.put("c", 3)
    c.log.flush()
    c2 = DurableLRU(2, p); assert list(c2.d) == ["a", "c"]
    with open(p, "a") as f: f.write('["put", "z"')          # simulate torn write
    c3 = DurableLRU(2, p); assert list(c3.d) == ["a", "c"]
    c3.compact(); c4 = DurableLRU(2, p); assert list(c4.d) == ["a", "c"]

# ============================================================ 4. interpreter
# >>> interp_v1
def run(prog):
    """prog lines: 'acc +1' | 'jmp -3' | 'nop +0'. Returns (first index executed twice or None, acc)."""
    acc, pc, seen = 0, 0, set()
    while pc != len(prog):                      # exactly one past the end = normal exit
        if pc in seen or not 0 <= pc < len(prog): return pc, acc
        seen.add(pc)
        op, arg = prog[pc].split(); arg = int(arg)
        if op == "acc": acc += arg; pc += 1
        elif op == "jmp": pc += arg
        elif op == "nop": pc += 1
        else: raise ValueError(f"bad op {op!r} at {pc}")
    return None, acc
# <<<

# >>> interp_v2
def repair(prog):
    """Flip exactly one jmp<->nop so the program terminates. O(n): find every index that can reach the end."""
    n = len(prog)
    def nxt(i, flip=False):
        op, arg = prog[i].split(); arg = int(arg)
        if flip: op = {"jmp": "nop", "nop": "jmp"}.get(op, op)
        return i + arg if op == "jmp" else i + 1
    preds = defaultdict(list)
    for i in range(n): preds[nxt(i)].append(i)
    good, stack = {n}, [n]                       # indices from which the end is reachable, unflipped
    while stack:
        j = stack.pop()
        for i in preds[j]:
            if i not in good: good.add(i); stack.append(i)
    pc, seen = 0, set()                          # walk the original path; first flip that lands in 'good'
    while pc not in seen and 0 <= pc < n:
        seen.add(pc)
        if prog[pc].split()[0] in ("jmp", "nop") and nxt(pc, flip=True) in good:
            fixed = list(prog); op, arg = prog[pc].split()
            fixed[pc] = ("nop " if op == "jmp" else "jmp ") + arg
            return pc, run(fixed)[1]
        pc = nxt(pc)
    return None
# <<<

def _interp_tests():
    P = ["nop +0", "acc +1", "jmp +4", "acc +3", "jmp -3", "acc -99", "acc +1", "jmp -4", "acc +6"]
    assert run(P) == (1, 5)
    assert repair(P) == (7, 8)
    assert run(["acc +2"]) == (None, 2)
    assert run(["jmp +5"]) == (5, 0)

# ============================================================ 5. distributed mode / median
# >>> dist_v1
from collections import Counter

def distributed_mode(shards):
    partials = [Counter(s) for s in shards]      # on each worker: send {value: count}
    total = Counter()
    for p in partials: total.update(p)           # at the coordinator (or a log2(W) tree reduce)
    return total.most_common(1)[0][0]
# <<<

# >>> dist_v2
def distributed_median(shards):
    """Binary search on the VALUE range. Each round every worker sends one integer."""
    n = sum(len(s) for s in shards); k = (n - 1) // 2          # rank of the lower median
    lo = min(min(s) for s in shards if s); hi = max(max(s) for s in shards if s)
    rounds = 0
    while lo < hi:
        mid = (lo + hi) // 2; rounds += 1
        below = sum(sum(1 for x in s if x <= mid) for s in shards)   # O(log m) per worker if s is sorted
        if below > k: hi = mid
        else: lo = mid + 1
    return lo, rounds
# <<<

def _dist_tests():
    import random
    r = random.Random(1)
    data = [r.randint(0, 1000) for _ in range(1001)]
    shards = [data[i::10] for i in range(10)]
    med, rounds = distributed_median(shards)
    assert med == sorted(data)[500] and rounds <= 11
    assert Counter(data)[distributed_mode(shards)] == max(Counter(data).values())

# ============================================================ 6. profiler
# >>> prof_v1
def to_events(samples):
    """samples: [(t, [outer, ..., inner])] in time order. Returns [(t, 'start'|'end', frame)]."""
    events, prev = [], []
    for t, stack in samples + [(samples[-1][0], [])]:      # a final empty stack closes everything
        i = 0
        while i < min(len(prev), len(stack)) and prev[i] == stack[i]:
            i += 1                                         # common prefix BY POSITION (recursion-safe)
        for f in reversed(prev[i:]): events.append((t, "end", f))   # innermost ends first
        for f in stack[i:]: events.append((t, "start", f))
        prev = stack
    return events
# <<<

def _prof_tests():
    e = to_events([(0, ["A", "B", "C"]), (1, ["A", "B", "D"]), (2, ["A", "E"])])
    assert e[:5] == [(0, "start", "A"), (0, "start", "B"), (0, "start", "C"), (1, "end", "C"), (1, "start", "D")]
    assert to_events([(0, ["f", "f"]), (1, ["f"])])[2:] == [(1, "end", "f"), (2 - 1, "end", "f")]

# ============================================================ 7. bank (multi-level CodeSignal style)
# >>> bank_v1
class Bank:
    """Level 1: create, deposit, transfer. Every call returns a value or None on failure: never raise."""
    def __init__(self):
        self.bal, self.out = {}, defaultdict(int)          # out: total outgoing, for level 2

    def create(self, ts, acct):
        if acct in self.bal: return False
        self.bal[acct] = 0; return True

    def deposit(self, ts, acct, amt):
        if acct not in self.bal: return None
        self.bal[acct] += amt; return self.bal[acct]

    def transfer(self, ts, src, dst, amt):
        if src == dst or src not in self.bal or dst not in self.bal or self.bal[src] < amt: return None
        self.bal[src] -= amt; self.bal[dst] += amt; self.out[src] += amt
        return self.bal[src]
# <<<

# >>> bank_v2
    def top_spenders(self, ts, n):
        """Level 2: top n by outgoing total, ties by account id. Format 'id(total)'."""
        rows = sorted(self.bal, key=lambda a: (-self.out[a], a))[:n]
        return [f"{a}({self.out[a]})" for a in rows]
# <<<

# >>> bank_v3
class ScheduledBank(Bank):
    """Level 3: scheduled payments that fire when time reaches them. Process due payments at the
    start of EVERY call, in (due time, creation order) order."""
    def __init__(self):
        super().__init__(); self.sched, self.seq, self.cancelled = [], itertools.count(1), set()

    def _tick(self, ts):
        while self.sched and self.sched[0][0] <= ts:
            due, n, src, amt = heapq.heappop(self.sched)
            if n in self.cancelled: continue
            if self.bal.get(src, -1) >= amt:              # skipped silently if funds are short
                self.bal[src] -= amt; self.out[src] += amt

    def schedule_payment(self, ts, src, amt, delay):
        self._tick(ts)
        if src not in self.bal: return None
        n = next(self.seq); heapq.heappush(self.sched, (ts + delay, n, src, amt))
        return f"payment{n}"

    def cancel_payment(self, ts, src, pid):
        self._tick(ts)
        n = int(pid.removeprefix("payment"))
        if n in self.cancelled or not any(p[1] == n and p[2] == src for p in self.sched): return False
        self.cancelled.add(n); return True

    def deposit(self, ts, acct, amt): self._tick(ts); return super().deposit(ts, acct, amt)
    def transfer(self, ts, s, d, amt): self._tick(ts); return super().transfer(ts, s, d, amt)
    def top_spenders(self, ts, n): self._tick(ts); return super().top_spenders(ts, n)
# <<<

def _bank_tests():
    b = ScheduledBank()
    assert b.create(1, "a") and b.create(2, "b") and not b.create(3, "a")
    assert b.deposit(4, "a", 100) == 100 and b.deposit(5, "zz", 1) is None
    assert b.transfer(6, "a", "b", 30) == 70 and b.transfer(7, "a", "a", 1) is None and b.transfer(8, "b", "a", 999) is None
    assert b.top_spenders(9, 2) == ["a(30)", "b(0)"]
    p = b.schedule_payment(10, "a", 50, 5); q = b.schedule_payment(11, "a", 50, 5)
    assert b.cancel_payment(12, "a", q) and not b.cancel_payment(12, "a", q)
    assert b.deposit(15, "b", 0) == 30 and b.bal["a"] == 20 and b.top_spenders(16, 1) == ["a(80)"]

# ============================================================ 8. indexed sequence (OpenAI)
# >>> seq_v1
class SqrtSeq:
    """insert(i, v) and get(i) in O(sqrt n): a list of blocks, each at most B long."""
    def __init__(self, B=64):
        self.B, self.blocks = B, [[]]

    def _find(self, i):
        for bi, blk in enumerate(self.blocks):
            if i < len(blk) or bi == len(self.blocks) - 1: return bi, i
            i -= len(blk)

    def insert(self, i, v):
        bi, j = self._find(i)
        blk = self.blocks[bi]; blk.insert(j, v)
        if len(blk) > 2 * self.B:                         # split keeps every block O(B)
            self.blocks[bi:bi + 1] = [blk[:self.B], blk[self.B:]]

    def get(self, i):
        bi, j = self._find(i); return self.blocks[bi][j]
# <<<

def _seq_tests():
    import random
    r = random.Random(3); s, ref = SqrtSeq(B=4), []
    for _ in range(500):
        i = r.randint(0, len(ref)); v = r.random(); s.insert(i, v); ref.insert(i, v)
    assert all(s.get(i) == ref[i] for i in range(len(ref)))

# ============================================================ 9. cloud credit replay (OpenAI / Perplexity)
# >>> credit_v1
def balance_at(grants, usages, t):
    """grants: [(id, amount, start, expire)], usages: [(time, amount)]. Events may arrive out of order,
    so every query replays all known events up to t. Usage draws from the active grant expiring first.
    Returns remaining active credit at t, or -1 if any usage up to t could not be covered."""
    left = {g[0]: g[1] for g in grants}
    for ut, amt in sorted(u for u in usages if u[0] <= t):
        active = sorted((g for g in grants if g[2] <= ut < g[3] and left[g[0]] > 0), key=lambda g: (g[3], g[0]))
        for g in active:
            take = min(amt, left[g[0]]); left[g[0]] -= take; amt -= take
            if amt == 0: break
        if amt > 0: return -1
    return sum(left[g[0]] for g in grants if g[2] <= t < g[3])
# <<<

def _credit_tests():
    G = [("g1", 10, 0, 10), ("g2", 5, 0, 5)]
    assert balance_at(G, [(2, 4)], 3) == 11                 # took from g2 (expires first)
    assert balance_at(G, [(2, 4)], 6) == 10                 # g2 expired with 1 left
    assert balance_at(G, [(7, 20)], 8) == -1
    assert balance_at(G, [(2, 4), (1, 3)], 3) == 8          # out-of-order arrival, replayed by time

# ============================================================ 10. streaming longest subarray with average S (Google)
# >>> avg_v1
class LongestAvg:
    """Average of a[i..j] == S  <=>  sum(a[k] - S) over i..j == 0  <=>  equal prefix sums of (a - S)."""
    def __init__(self, S):
        self.S, self.p, self.n, self.best = S, 0, 0, 0
        self.first = {0: 0}                               # prefix value -> earliest index it appeared

    def add(self, x):
        self.n += 1; self.p += x - self.S
        if self.p in self.first: self.best = max(self.best, self.n - self.first[self.p])
        else: self.first[self.p] = self.n
        return self.best
# <<<

def _avg_tests():
    la = LongestAvg(2)
    out = [la.add(x) for x in [1, 3, 2, 5, -1, 2]]
    assert out == [0, 2, 3, 3, 5, 6], out

# ============================================================ 11. DAG with M workers (Google)
# >>> dag_v1
def finish_time(dur, deps, M=None):
    """dur: {task: time}; deps: {task: [prereqs]}. M=None: unlimited workers (critical path)."""
    indeg = {t: 0 for t in dur}; kids = defaultdict(list)
    for t, ps in deps.items():
        for p in ps: indeg[t] += 1; kids[p].append(t)
    if M is None:                                          # longest path in topological order
        end, ready = {}, [t for t in dur if indeg[t] == 0]
        start = {t: 0 for t in dur}; done = 0
        while ready:
            t = ready.pop(); end[t] = start[t] + dur[t]; done += 1
            for k in kids[t]:
                start[k] = max(start[k], end[t]); indeg[k] -= 1
                if indeg[k] == 0: ready.append(k)
        if done != len(dur): raise ValueError("cycle")
        return max(end.values(), default=0)
    # M workers: event simulation. Greedy list scheduling, longest task first among the ready ones.
    ready = [(-dur[t], t) for t in dur if indeg[t] == 0]; heapq.heapify(ready)
    running, now, done = [], 0, 0                          # running: heap of (finish time, task)
    while ready or running:
        while ready and len(running) < M:
            _, t = heapq.heappop(ready); heapq.heappush(running, (now + dur[t], t))
        now, t = heapq.heappop(running); done += 1
        for k in kids[t]:
            indeg[k] -= 1
            if indeg[k] == 0: heapq.heappush(ready, (-dur[k], k))
    if done != len(dur): raise ValueError("cycle")
    return now
# <<<

def _dag_tests():
    dur = {"a": 3, "b": 2, "c": 4, "d": 1}; deps = {"c": ["a"], "d": ["a", "b"]}
    assert finish_time(dur, deps) == 7
    assert finish_time(dur, deps, M=1) == 10
    assert finish_time(dur, deps, M=2) == 7

# ============================================================ 12. word break, max subarray K, LC1338 (Microsoft)
# >>> wb_v1
from functools import lru_cache

def word_break(s, words):
    words = set(words); L = max(map(len, words), default=0)
    @lru_cache(None)
    def go(i):                                  # best split of s[i:], or None
        if i == len(s): return []
        for j in range(i + 1, min(len(s), i + L) + 1):
            if s[i:j] in words:
                rest = go(j)
                if rest is not None: return [s[i:j]] + rest
        return None
    r = go(0)
    return " ".join(r) if r is not None else None
# <<<

# >>> kad_v1
def max_sub(a):
    best = cur = a[0]
    for x in a[1:]: cur = max(x, cur + x); best = max(best, cur)
    return best

def max_sub_k(a, k):
    """Max subarray of a repeated k times. Only 1 or 2 copies matter, plus (k-2) whole middle copies if total > 0."""
    if k == 1: return max_sub(a)
    total = sum(a)
    two = max_sub(a + a)
    return two + (k - 2) * total if total > 0 else two
# <<<

# >>> half_v1
def min_set_half(a):
    """Fewest distinct values whose removal deletes at least half the array: take the most frequent first."""
    need, removed = (len(a) + 1) // 2, 0
    for i, c in enumerate(sorted(Counter(a).values(), reverse=True), 1):
        removed += c
        if removed >= need: return i
    return 0
# <<<

def _ms_tests():
    assert word_break("applepenapple", ["apple", "pen"]) == "apple pen apple"
    assert word_break("catsandog", ["cats", "dog", "sand", "and", "cat"]) is None
    assert max_sub_k([1, -2, 1], 5) == 2 and max_sub_k([1, 2], 3) == 9 and max_sub_k([-1, -2], 7) == -1
    assert min_set_half([3, 3, 3, 3, 5, 5, 5, 2, 2, 7]) == 2 and min_set_half([7] * 6) == 1

if __name__ == '__main__':
    for f in [_crawl_tests, _wq_tests, _lru_tests, _interp_tests, _dist_tests, _prof_tests, _bank_tests,
              _seq_tests, _credit_tests, _avg_tests, _dag_tests, _ms_tests]:
        f(); print('ok', f.__name__)
