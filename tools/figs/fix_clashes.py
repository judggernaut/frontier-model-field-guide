"""Regenerate figures whose labels collided, in the guide palette (light; figures sit on a light card in both themes)."""
import os, numpy as np, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'figs')
PUR, ORG, TEAL, MUT, LINE, INK = '#4E3591', '#C2410C', '#2B6E80', '#535A57', '#AEB7B3', '#160C28'
plt.rcParams.update({'font.size': 11, 'axes.edgecolor': LINE, 'axes.labelcolor': MUT, 'xtick.color': MUT, 'ytick.color': MUT,
                     'axes.spines.top': False, 'axes.spines.right': False, 'axes.titlecolor': MUT, 'axes.titlesize': 11.5,
                     'legend.frameon': False, 'savefig.facecolor': 'white'})
rng = np.random.default_rng(7)
def save(fig, name): fig.savefig(os.path.join(OUT, name), dpi=200, bbox_inches='tight', pad_inches=0.12); plt.close(fig)

# stats-005: sd widths + box plots with and without outliers
fig, (a, b) = plt.subplots(1, 2, figsize=(8.4, 3.0), gridspec_kw={'wspace': 0.35})
x = np.linspace(-6, 6, 400)
for sd, c, lab in [(1, PUR, 'sd = 1'), (2, ORG, 'sd = 2')]:
    y = np.exp(-x**2 / (2 * sd * sd)) / (sd * np.sqrt(2 * np.pi)); a.plot(x, y, c=c, lw=2.4)
    a.text(sd * 1.15 + 0.15, y[np.argmin(abs(x - sd * 1.15))] + 0.01, lab, color=c, fontsize=10.5, fontweight='bold')
a.set_title('standard deviation sets the width'); a.set_yticks([])
clean = rng.normal(50, 10, 60); dirty = np.r_[clean, 200, 240]
bp = b.boxplot([clean, dirty], orientation='horizontal', widths=0.45, patch_artist=True,
               boxprops=dict(facecolor='#EDE9F5', edgecolor=PUR), medianprops=dict(color=PUR, lw=2),
               whiskerprops=dict(color=PUR), capprops=dict(color=PUR), flierprops=dict(marker='o', mfc='none', mec=ORG, ms=6))
b.set_yticks([1, 2], ['clean', 'clean + 2\noutliers']); b.tick_params(axis='y', length=0)
b.set_title('IQR ignores the two outliers; sd does not'); b.set_xlim(0, 260)
save(fig, 'stats-005.png')

# stats-025: two populations, labelled beside (not on top of) each hump
cached = rng.normal(1.2, 0.25, 3000); cold = rng.normal(6.5, 1.5, 700)
fig, ax = plt.subplots(figsize=(8.4, 3.0))
bins = np.linspace(0, 11.5, 90)
ax.hist(cached, bins, color=PUR); ax.hist(cold, bins, color=ORG)
top = np.histogram(cached, bins)[0].max()
ax.annotate('cached responses', xy=(1.75, top * 0.55), xytext=(2.6, top * 0.75), color=PUR, fontweight='bold', fontsize=11,
            arrowprops=dict(arrowstyle='-', color=PUR, lw=1))
ax.text(6.5, np.histogram(cold, bins)[0].max() + top * 0.07, 'cold starts', color=ORG, fontweight='bold', fontsize=11, ha='center')
ax.set_title('two populations, not one distribution with outliers'); ax.set_xlabel('latency (seconds)'); ax.set_yticks([])
save(fig, 'stats-025.png')

# stats-075: mixture of two overlapping populations; the observed curve is their sum
x = np.linspace(0, 12, 600)
def n(x, m, s): return np.exp(-(x - m)**2 / (2 * s * s)) / (s * np.sqrt(2 * np.pi))
c1 = 0.6 * n(x, 1.8, 0.6); c2 = 0.4 * n(x, 5.0, 1.8); tot = c1 + c2
fig, ax = plt.subplots(figsize=(8.4, 3.2))
ax.fill_between(x, c1, color=PUR, alpha=.12, lw=0); ax.fill_between(x, c2, color=ORG, alpha=.12, lw=0)
ax.plot(x, c1, c=PUR, lw=2, ls='--'); ax.plot(x, c2, c=ORG, lw=2, ls='--'); ax.plot(x, tot, c=INK, lw=2.6)
ax.text(0.15, tot.max() * 1.06, 'fast: 60% of requests, around 1.8 s', color=PUR, fontweight='bold', fontsize=10.5)
ax.text(6.9, c2.max() * 1.25, 'slow: 40%, around 5 s', color=ORG, fontweight='bold', fontsize=10.5)
k = np.argmin(abs(x - 3.3))
ax.annotate('what you observe = the sum', xy=(3.3, tot[k]), xytext=(5.4, tot.max() * 0.72), color=INK, fontsize=10.5,
            arrowprops=dict(arrowstyle='-', color=INK, lw=1))
ax.set_ylim(0, tot.max() * 1.2); ax.set_xlabel('latency (seconds)'); ax.set_yticks([])
save(fig, 'stats-075.png')
print('ok')
