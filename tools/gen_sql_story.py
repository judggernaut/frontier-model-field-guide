#!/usr/bin/env python3
"""Generate the step-through story for the SQL appendix (src/sections/91-sql.html includes its output between markers)."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ROWS = [(1,'A','math',.62),(2,'A','code',.71),(3,'A','math',.58),(4,'A','chat',.88),
        (5,'B','math',.74),(6,'B','code',.69),(7,'B','math',.80),(8,'B','chat',.91),(9,'B','code',.77),(10,'B','chat',.35)]
COL = {'math': 'var(--eli5)', 'code': 'var(--lead)', 'chat': 'var(--deep)'}

def card(x, y, r, dim=False, d=0, w=52, h=30):
    op = ' opacity=".22"' if dim else ''
    return (f'<g class="a" style="--d:{d}"{op}><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="var(--surface)" '
            f'stroke="{COL[r[2]]}" stroke-width="2"/><text x="{x+w/2}" y="{y+13}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--fg)">{r[1]} · {r[2]}</text>'
            f'<text x="{x+w/2}" y="{y+26}" text-anchor="middle" font-size="12" fill="var(--muted)">{r[3]:.2f}</text></g>')

def svg(body, label, clause):
    return (f'<svg viewBox="0 0 640 260" role="img" aria-label="{label}">'
            f'<rect x="20" y="14" width="600" height="30" rx="8" fill="var(--sunk)"/>'
            f'<text x="320" y="34" text-anchor="middle" font-size="14" style="font-family:var(--font-mono)" fill="var(--fg)">{clause}</text>{body}</svg>')

steps = []
# 1 FROM
b = ''.join(card(28 + (i % 5) * 120, 70 + (i // 5) * 50, r, d=i // 5, w=100) for i, r in enumerate(ROWS))
b += '<text class="a" style="--d:2" x="320" y="215" text-anchor="middle" font-size="14" fill="var(--fg)">Ten rows. Nothing is filtered, grouped or computed yet.</text>'
steps.append((svg(b, 'Ten evaluation rows laid out', '1 · FROM evals'),
  'The database starts with the table named in <code>FROM</code> (and any <code>JOIN</code>s). Ten rows: two models, three task categories, one score each. Everything later works on this pile.'))
# 2 WHERE
b = ''.join(card(28 + (i % 5) * 120, 70 + (i // 5) * 50, r, dim=r[1] != 'B', d=0, w=100) for i, r in enumerate(ROWS))
b += '<text class="a" style="--d:1" x="320" y="215" text-anchor="middle" font-size="14" fill="var(--fg)">Model A rows are thrown away before anything is counted.</text>'
steps.append((svg(b, 'Rows for model A fade out', "2 · WHERE model = 'B'"),
  '<code>WHERE</code> tests one row at a time and drops the rows that fail. It runs before grouping, so it cannot mention <code>COUNT</code> or <code>AVG</code>: those do not exist yet.'))
# 3 GROUP BY
B = [r for r in ROWS if r[1] == 'B']; b = ''
for gi, cat in enumerate(['math', 'code', 'chat']):
    x = 40 + gi * 200
    b += f'<g class="a" style="--d:{gi}"><rect x="{x}" y="60" width="160" height="130" rx="12" fill="none" stroke="{COL[cat]}" stroke-dasharray="5 5"/><text x="{x+80}" y="80" text-anchor="middle" font-size="13" font-weight="600" fill="{COL[cat]}">{cat}</text></g>'
    for k, r in enumerate([r for r in B if r[2] == cat]):
        b += card(x + 30, 92 + k * 46, r, d=gi, w=100)
b += '<text class="a" style="--d:3" x="320" y="225" text-anchor="middle" font-size="14" fill="var(--fg)">Six rows become three groups. From here on, one group = one output row.</text>'
steps.append((svg(b, 'Model B rows sorted into three category bins', '3 · GROUP BY category'),
  '<code>GROUP BY</code> sorts the surviving rows into bins, one per category. After this step the query can only talk about whole bins: the bin key, or an aggregate over the bin.'))
# 4 HAVING
b = ''
for gi, (cat, m) in enumerate([('math', .77), ('code', .73), ('chat', .63)]):
    x = 40 + gi * 200; dim = m < .7
    op = ' opacity=".25"' if dim else ''
    b += (f'<g class="a" style="--d:{gi}"{op}><rect x="{x}" y="70" width="160" height="100" rx="12" fill="var(--surface)" stroke="{COL[cat]}" stroke-width="2"/>'
          f'<text x="{x+80}" y="100" text-anchor="middle" font-size="14" font-weight="600" fill="{COL[cat]}">{cat}</text>'
          f'<text x="{x+80}" y="135" text-anchor="middle" font-size="15" fill="var(--fg)">AVG = {m:.2f}</text></g>')
b += '<g class="a" style="--d:3"><line x1="450" y1="80" x2="590" y2="160" stroke="var(--warn)" stroke-width="3"/><line x1="590" y1="80" x2="450" y2="160" stroke="var(--warn)" stroke-width="3"/></g>'
b += '<text class="a" style="--d:4" x="320" y="215" text-anchor="middle" font-size="14" fill="var(--fg)">chat averages 0.63 (one 0.35 run) and is dropped.</text>'
steps.append((svg(b, 'The chat group is crossed out', '4 · HAVING AVG(score) >= 0.7'),
  '<code>HAVING</code> is <code>WHERE</code> for groups. It runs after the aggregates are known, so this is where conditions on <code>COUNT</code>, <code>AVG</code> or <code>SUM</code> belong.'))
# 5 SELECT
b = ('<g class="a" style="--d:0"><rect x="150" y="66" width="340" height="34" rx="6" fill="var(--sunk)"/>'
     '<text x="200" y="88" font-size="13" font-weight="600" fill="var(--muted)">category</text><text x="320" y="88" font-size="13" font-weight="600" fill="var(--muted)">n</text><text x="390" y="88" font-size="13" font-weight="600" fill="var(--muted)">mean_score</text></g>')
for k, (cat, n, m) in enumerate([('math', 2, .77), ('code', 2, .73)]):
    y = 100 + k * 36
    b += (f'<g class="a" style="--d:{k+1}"><rect x="150" y="{y}" width="340" height="34" fill="var(--surface)" stroke="var(--line)"/>'
          f'<text x="200" y="{y+22}" font-size="14" fill="{COL[cat]}" font-weight="600">{cat}</text><text x="320" y="{y+22}" font-size="14" fill="var(--fg)">{n}</text><text x="390" y="{y+22}" font-size="14" fill="var(--fg)">{m:.2f}</text></g>')
b += '<text class="a" style="--d:3" x="320" y="215" text-anchor="middle" font-size="14" fill="var(--fg)">Only now do the column names (aliases) exist.</text>'
steps.append((svg(b, 'Two output rows with computed columns', '5 · SELECT category, COUNT(*) AS n, AVG(score) AS mean_score'),
  '<code>SELECT</code> comes fifth, even though it is written first. It computes the output columns and gives them names. That is why <code>WHERE mean_score &gt; 0.7</code> fails: the name is invented after <code>WHERE</code> ran.'))
# 6 ORDER BY / LIMIT
b = ('<g class="a" style="--d:0"><rect x="150" y="76" width="340" height="40" rx="6" fill="var(--good-soft)" stroke="var(--good)" stroke-width="2"/>'
     '<text x="200" y="102" font-size="15" font-weight="600" fill="var(--eli5)">math</text><text x="320" y="102" font-size="15" fill="var(--fg)">2</text><text x="390" y="102" font-size="15" fill="var(--fg)">0.77</text></g>'
     '<g class="a" style="--d:1" opacity=".3"><rect x="150" y="122" width="340" height="40" rx="6" fill="var(--surface)" stroke="var(--line)"/>'
     '<text x="200" y="148" font-size="15" font-weight="600" fill="var(--lead)">code</text><text x="320" y="148" font-size="15" fill="var(--fg)">2</text><text x="390" y="148" font-size="15" fill="var(--fg)">0.73</text></g>'
     '<text class="a" style="--d:2" x="320" y="215" text-anchor="middle" font-size="14" fill="var(--fg)">Sort, then keep the first row. ORDER BY may use the alias.</text>')
steps.append((svg(b, 'Sorted result with one row kept', '6 · ORDER BY mean_score DESC LIMIT 1'),
  'Last, <code>ORDER BY</code> sorts the finished rows (it can use <code>mean_score</code>, because <code>SELECT</code> has run) and <code>LIMIT</code> keeps the first one. Answer: model B is strongest on math.'))

story = ('<div class="story" id="st-sql-order">\n  <div class="story-head"><div class="story-title">Written top to bottom, run in a different order</div>'
         '<p class="story-sub">One query over ten eval rows, followed clause by clause in the order the database applies them.</p></div>\n')
for s, cap in steps:
    story += f'  <div class="step">\n    {s}\n    <p>{cap}</p>\n  </div>\n'
story += '</div>'

p = os.path.join(ROOT, 'src', 'sections', '91-sql.html')
s = open(p, encoding='utf-8').read()
s = re.sub(r'<!--STORY-->.*?<!--/STORY-->', '<!--STORY-->\n' + story.replace('\\', '\\\\') + '\n<!--/STORY-->', s, flags=re.S)
open(p, 'w', encoding='utf-8').write(s)
print('story written')
