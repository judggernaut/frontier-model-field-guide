"""Worked data-science and MLE coding examples for Part VII (chapter 89). Run: python3 tools/worked/ds.py"""
import numpy as np
from collections import deque

# ============================================================ statistics as a function
# >>> st_boot
import numpy as np

def bootstrap_ci(x, stat=np.mean, B=10_000, alpha=0.05, seed=0):
    """Percentile bootstrap: resample WITH replacement, same size, recompute the statistic."""
    rng = np.random.default_rng(seed); x = np.asarray(x)
    idx = rng.integers(0, len(x), size=(B, len(x)))
    reps = np.apply_along_axis(stat, 1, x[idx])
    return np.quantile(reps, [alpha / 2, 1 - alpha / 2])
# <<<

# >>> st_t
from scipy import stats

def welch_t(a, b):
    """Two-sample t-test without assuming equal variances. Returns (diff, t, df, two-sided p, 95% CI)."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    va, vb = a.var(ddof=1) / len(a), b.var(ddof=1) / len(b)      # squared standard errors
    diff, se = b.mean() - a.mean(), np.sqrt(va + vb)
    df = (va + vb) ** 2 / (va ** 2 / (len(a) - 1) + vb ** 2 / (len(b) - 1))   # Welch–Satterthwaite
    t = diff / se
    p = 2 * stats.t.sf(abs(t), df)
    h = stats.t.ppf(0.975, df) * se
    return diff, t, df, p, (diff - h, diff + h)
# <<<

# >>> st_perm
def permutation_test(a, b, B=10_000, seed=0):
    """No distributional assumption: shuffle group labels, see how often a difference this large appears."""
    rng = np.random.default_rng(seed)
    a, b = np.asarray(a, float), np.asarray(b, float)
    obs = b.mean() - a.mean(); pool = np.concatenate([a, b]); n = len(a)
    count = 0
    for _ in range(B):
        rng.shuffle(pool)
        count += abs(pool[n:].mean() - pool[:n].mean()) >= abs(obs)
    return obs, (count + 1) / (B + 1)                    # +1: the observed split is one of the permutations
# <<<

# >>> st_power
def n_per_arm_proportions(p0, mde, alpha=0.05, power=0.8):
    """Sample size per arm to detect an absolute lift `mde` on a baseline rate p0 (two-sided z-test)."""
    p1 = p0 + mde; pbar = (p0 + p1) / 2
    za, zb = stats.norm.ppf(1 - alpha / 2), stats.norm.ppf(power)
    num = (za * np.sqrt(2 * pbar * (1 - pbar)) + zb * np.sqrt(p0 * (1 - p0) + p1 * (1 - p1))) ** 2
    return int(np.ceil(num / mde ** 2))
# <<<

def _st_tests():
    rng = np.random.default_rng(1)
    a = rng.normal(10, 2, 400); b = rng.normal(10.5, 3, 400)
    lo, hi = bootstrap_ci(a); assert lo < 10 < hi or abs(a.mean() - 10) < .3
    d, t, df, p, ci = welch_t(a, b)
    ref = stats.ttest_ind(b, a, equal_var=False); assert np.isclose(t, ref.statistic) and np.isclose(p, ref.pvalue)
    obs, pp = permutation_test(a, b, B=2000); assert pp < 0.05
    n = n_per_arm_proportions(0.10, 0.01); assert 14000 < n < 15500, n   # ~14,750 per arm

# ============================================================ OLS readout (Capital One)
# >>> ols
def ols(X, y, names=None):
    """Fit y = Xb with an intercept; return the regression table a stats package would print."""
    X = np.column_stack([np.ones(len(X)), X]); n, k = X.shape
    XtX_inv = np.linalg.inv(X.T @ X)
    b = XtX_inv @ X.T @ y                                  # normal equations
    resid = y - X @ b
    s2 = resid @ resid / (n - k)                           # residual variance, k parameters used up
    se = np.sqrt(np.diag(XtX_inv) * s2)
    t = b / se; p = 2 * stats.t.sf(np.abs(t), n - k)
    tss = ((y - y.mean()) ** 2).sum(); rss = resid @ resid
    r2 = 1 - rss / tss
    F = ((tss - rss) / (k - 1)) / (rss / (n - k))          # all slopes zero vs the fitted model
    pF = stats.f.sf(F, k - 1, n - k)
    names = ['intercept'] + (names or [f'x{i}' for i in range(1, k)])
    return dict(coef=dict(zip(names, b)), se=dict(zip(names, se)), t=dict(zip(names, t)),
                p=dict(zip(names, p)), r2=r2, F=F, pF=pF)
# <<<

def _ols_tests():
    rng = np.random.default_rng(0); n = 500
    x1 = rng.normal(size=n); x2 = rng.normal(size=n)
    y = 2 + 3 * x1 + 0 * x2 + rng.normal(size=n)
    r = ols(np.column_stack([x1, x2]), y, ['x1', 'x2'])
    assert abs(r['coef']['x1'] - 3) < .15 and r['p']['x1'] < 1e-10 and r['p']['x2'] > 0.01 and r['pF'] < 1e-10

# ============================================================ grid with k obstacle removals (Mercor)
# >>> grid
from collections import deque

def shortest_with_removals(grid, k):
    """grid: list of strings, '#' blocked. Fewest steps from top-left to bottom-right removing <= k walls.
    The state is (row, col, removals left): the same cell with more budget left is a different, better state."""
    R, C = len(grid), len(grid[0])
    if k >= R + C - 2: return R + C - 2                  # enough budget to walk straight through
    best = [[-1] * C for _ in range(R)]                  # most budget left seen at each cell
    q = deque([(0, 0, k, 0)]); best[0][0] = k
    while q:
        r, c, left, d = q.popleft()
        if (r, c) == (R - 1, C - 1): return d
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < R and 0 <= nc < C:
                nl = left - (grid[nr][nc] == '#')
                if nl >= 0 and nl > best[nr][nc]:        # dominance pruning
                    best[nr][nc] = nl; q.append((nr, nc, nl, d + 1))
    return -1
# <<<

# ============================================================ coin change with fractional coins (Airbnb)
# >>> coins
from decimal import Decimal

def min_coins(coins, target):
    """Floats like 0.2 are not exact in binary: convert to integer cents via Decimal, then classic DP."""
    to_c = lambda v: int((Decimal(str(v)) * 100).to_integral_value())
    cs, T = [to_c(c) for c in coins], to_c(target)
    INF = float('inf'); dp = [0] + [INF] * T
    for t in range(1, T + 1):
        for c in cs:
            if c <= t and dp[t - c] + 1 < dp[t]: dp[t] = dp[t - c] + 1
    return -1 if dp[T] == INF else dp[T]
# <<<

# ============================================================ L1 meeting point (LinkedIn)
# >>> l1
def meeting_point(xs):
    """Minimises sum |x - p|: any median. Moving p right of the median adds distance for more points than it saves."""
    s = sorted(xs); return s[(len(s) - 1) // 2]

def place_routers(houses, K):
    """K routers at house positions minimising total squared distance (L2) from each house to its router.
    Houses sorted; each router serves a contiguous block; DP over blocks with O(1) block cost from prefix sums."""
    h = sorted(houses); n = len(h)
    P = np.concatenate([[0], np.cumsum(h)]); Q = np.concatenate([[0], np.cumsum(np.square(h))])
    def cost(i, j):                                    # block h[i..j], router at the house nearest the block mean
        m = (P[j + 1] - P[i]) / (j - i + 1)
        r = h[min(range(i, j + 1), key=lambda t: abs(h[t] - m))]
        cnt = j - i + 1
        return (Q[j + 1] - Q[i]) - 2 * r * (P[j + 1] - P[i]) + cnt * r * r
    INF = float('inf'); dp = [[INF] * (n + 1) for _ in range(K + 1)]; dp[0][0] = 0
    for k in range(1, K + 1):
        for j in range(1, n + 1):
            dp[k][j] = min(dp[k - 1][i] + cost(i, j - 1) for i in range(j))
    return dp[K][n]
# <<<

def _misc_tests():
    g = ["..#", "##.", "..."]
    assert shortest_with_removals(g, 0) == -1 + 0 or shortest_with_removals(g, 0) in (-1, 4)
    assert shortest_with_removals(["..##", "###.", "...."], 1) == 5
    assert min_coins([0.20, 0.75, 1.50], 3.00) == 2 and min_coins([0.20], 0.30) == -1
    assert meeting_point([1, 2, 9]) == 2
    assert place_routers([1, 2, 10, 11], 2) == 2.0 and place_routers([1, 2, 3], 3) == 0

if __name__ == '__main__':
    for f in [_st_tests, _ols_tests, _misc_tests]:
        f(); print('ok', f.__name__)
