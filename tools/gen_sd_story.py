#!/usr/bin/env python3
"""Generate the 'bakery that grows' story for src/sections/92-sysdesign.html (between <!--STORY--> markers)."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def box(x, y, w, h, label, sub='', col='var(--line-strong)', d=0, cls='a'):
    s = f'<g class="{cls}" style="--d:{d}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="var(--surface)" stroke="{col}" stroke-width="2"/>'
    s += f'<text x="{x+w/2}" y="{y+h/2+(-3 if sub else 5)}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--fg)">{label}</text>'
    if sub: s += f'<text x="{x+w/2}" y="{y+h/2+14}" text-anchor="middle" font-size="12" fill="var(--muted)">{sub}</text>'
    return s + '</g>'

def arrow(x1, y1, x2, y2, d=0, col='var(--faint)'):
    return f'<path class="a dash" style="--d:{d}" d="M{x1} {y1} L{x2} {y2}" stroke="{col}" stroke-width="2" fill="none" marker-end="url(#sdarr)"/>'

DEFS = '<defs><marker id="sdarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="var(--faint)"/></marker></defs>'
def svg(body, label, foot):
    return (f'<svg viewBox="0 0 640 260" role="img" aria-label="{label}">{DEFS}{body}'
            f'<text class="a" style="--d:5" x="320" y="245" text-anchor="middle" font-size="14" fill="var(--fg)">{foot}</text></svg>')

U = lambda d=0: box(20, 100, 90, 50, 'Users', '', 'var(--eli5)', d)
steps = []
b = U() + arrow(110, 125, 250, 125, 1) + box(250, 95, 140, 60, 'App + DB', 'one machine', 'var(--accent)', 2)
steps.append((svg(b, 'Users talk to a single server', '≈ 100 requests/s: one box is fine, and the simplest design wins.'),
  'Every system starts as one machine running the code and the database. Below a few hundred requests per second, that is the right design, and saying so in an interview is a strength.'))
b = U() + arrow(110, 125, 180, 125, 0) + box(180, 100, 100, 50, 'Load bal.', '', 'var(--lead)', 1)
for i, y in enumerate([40, 100, 160]):
    b += arrow(280, 125, 340, y + 25, 2) + box(340, y, 110, 50, f'App {i+1}', 'stateless', 'var(--accent)', 2)
    b += arrow(450, y + 25, 510, 125, 3)
b += box(510, 100, 110, 50, 'Database', '', 'var(--deep)', 3)
steps.append((svg(b, 'A load balancer spreads users over three app servers', 'Stateless servers behind a balancer scale by adding copies.'),
  'When one server is not enough, put several identical, stateless copies behind a load balancer. Anything they must remember (sessions, uploads) moves to the database or a shared store.'))
b = U() + arrow(110, 125, 200, 125, 0) + box(200, 100, 110, 50, 'App tier', '×N', 'var(--accent)', 1)
b += arrow(310, 115, 400, 60, 2) + box(400, 35, 110, 50, 'Cache', '90% of reads', 'var(--good)', 2)
b += arrow(310, 135, 400, 180, 3) + box(400, 160, 110, 50, 'Database', '10% of reads', 'var(--deep)', 3)
steps.append((svg(b, 'A cache absorbs most reads before the database', 'A 90% hit rate cuts database reads tenfold.'),
  'Reads usually outnumber writes many times over, and a small set of items gets most of them. A cache in front of the database serves those from memory in about a millisecond.'))
b = U() + arrow(110, 125, 180, 125, 0) + box(180, 100, 100, 50, 'App tier', '', 'var(--accent)', 1)
b += arrow(280, 115, 340, 60, 2) + box(340, 35, 120, 50, 'Primary', 'all writes', 'var(--deep)', 2)
for i, y in enumerate([110, 175]):
    b += arrow(280, 135, 340, y + 20, 3) + box(340, y, 120, 45, f'Replica {i+1}', 'copy · reads', 'var(--deep)', 3)
b += arrow(460, 60, 500, 60, 4) + box(500, 35, 120, 170, 'Shards', 'split by user_id', 'var(--lead)', 4)
steps.append((svg(b, 'A primary with read replicas, then shards', 'Replicas scale reads; shards scale writes and storage.'),
  'Read replicas copy the primary and take read traffic, at the cost of a little lag. When writes or data outgrow one primary, split the data by a key across several (sharding).'))
b = U() + arrow(110, 125, 180, 125, 0) + box(180, 100, 100, 50, 'App tier', '', 'var(--accent)', 1)
b += arrow(280, 125, 340, 125, 2) + box(340, 100, 110, 50, 'Queue', 'buffers spikes', 'var(--warn)', 2)
b += arrow(450, 125, 510, 125, 3) + box(510, 100, 110, 50, 'Workers', 'email, video…', 'var(--good)', 3)
steps.append((svg(b, 'Slow work goes onto a queue for workers', 'Answer the user now; do slow work later, at least once, idempotently.'),
  'Anything slow or spiky (sending email, encoding video, counting clicks) goes on a queue. The user gets an answer immediately and workers catch up. Because a message can be delivered twice, the workers must be idempotent.'))

story = ('<div class="story" id="st-sd-bakery">\n  <div class="story-head"><div class="story-title">How a system grows</div>'
         '<p class="story-sub">The same app at five sizes, adding one building block each time.</p></div>\n')
for s, cap in steps: story += f'  <div class="step">\n    {s}\n    <p>{cap}</p>\n  </div>\n'
story += '</div>'
p = os.path.join(ROOT, 'src', 'sections', '92-sysdesign.html')
s = open(p, encoding='utf-8').read()
s = re.sub(r'<!--STORY-->.*?<!--/STORY-->', lambda m: '<!--STORY-->\n' + story + '\n<!--/STORY-->', s, flags=re.S)
open(p, 'w', encoding='utf-8').write(s); print('story written')
