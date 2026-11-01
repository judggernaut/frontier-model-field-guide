#!/usr/bin/env python3
"""Assemble src/ into one self-contained page.

  python3 build.py          -> dist/index.html (artifact fragment) + dist/standalone.html (full document)
  python3 build.py --pdf    -> also dist/frontier-model-field-guide.pdf
"""
import base64, glob, html, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC, DIST = os.path.join(ROOT, 'src'), os.path.join(ROOT, 'dist')
TITLE = 'Frontier Model Field Guide'
DESC = 'Statistics, evaluation, and training for large language models, each topic layered from plain words to principal-level depth.'

PARTS = [  # (first prefix, last prefix, part id, label, title, blurb)
    (0, 9, 'front', '', 'Start here', ''),
    (10, 19, 'part-1', 'Part I', 'Statistical foundations',
     'Distributions, sampling, intervals, and how to read the shape of your data. Everything later leans on this.'),
    (20, 29, 'part-2', 'Part II', 'Evaluating models',
     'Turning model outputs into numbers you can defend: eval statistics, classification metrics, judges, the offline to online gap, and the harness that produces it all.'),
    (30, 49, 'part-3', 'Part III', 'Training models',
     'How a frontier model is made: pretraining, optimisation, scaling, supervised fine-tuning, LoRA, reward models, RLHF, DPO, GRPO, distillation, inference, and safety training.'),
    (50, 59, 'part-4', 'Part IV', 'Leading the work',
     'How the pieces connect, the questions a principal asks, and a reference for every term.'),
]

def read(p): return open(p, encoding='utf-8').read()

def part_for(prefix):
    for p in PARTS:
        if p[0] <= prefix <= p[1]: return p
    raise ValueError(prefix)

def b64(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(open(path, 'rb').read()).decode()

def fonts_css():
    fs = os.path.join(ROOT, 'node_modules', '@fontsource')
    faces = [
        ('Geist', 'geist-sans/files/geist-sans-latin-400-normal.woff2', 400, 'normal'),
        ('Geist', 'geist-sans/files/geist-sans-latin-500-normal.woff2', 500, 'normal'),
        ('Geist', 'geist-sans/files/geist-sans-latin-600-normal.woff2', 600, 'normal'),
        ('Geist', 'geist-sans/files/geist-sans-latin-700-normal.woff2', 700, 'normal'),
        ('Geist Mono', 'geist-mono/files/geist-mono-latin-400-normal.woff2', 400, 'normal'),
        ('Geist Mono', 'geist-mono/files/geist-mono-latin-500-normal.woff2', 500, 'normal'),
    ]
    out = []
    for fam, f, w, st in faces:
        p = os.path.join(fs, f)
        if os.path.exists(p):
            out.append(f"@font-face{{font-family:'{fam}';font-style:{st};font-weight:{w};font-display:swap;src:url({b64(p, 'font/woff2')}) format('woff2')}}")
    return '\n'.join(out)

def glossary_html():
    terms = {}
    for f in sorted(glob.glob(os.path.join(SRC, 'glossary', '*.json'))):
        try: items = json.load(open(f, encoding='utf-8'))
        except Exception as e: print('glossary parse error', f, e); continue
        for it in items:
            k = it['term'].strip()
            key = k.lower()
            if key not in terms or len(it.get('def', '')) > len(terms[key].get('def', '')):
                terms[key] = dict(it, term=k)
    rows = []
    for key in sorted(terms, key=lambda s: re.sub(r'[^a-z0-9]', '', s)):
        it = terms[key]
        see = f' <a href="#{it["see"]}" class="small">→ section</a>' if it.get('see') else ''
        rows.append(f'<div class="gl" data-k="{html.escape(key)}"><dt>{html.escape(it["term"])}</dt><dd>{it["def"]}{see}</dd></div>')
    return f'<p class="muted">{len(rows)} terms. Type to filter.</p><input id="glq" type="search" placeholder="Filter terms, e.g. KL" class="noprint" style="width:100%;max-width:420px;font:inherit;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--fg);margin:0 0 14px"><dl class="glossary">' + '\n'.join(rows) + '</dl>'

def main(pdf=False):
    files = sorted(f for f in glob.glob(os.path.join(SRC, 'sections', '*.html')) if not os.path.basename(f).startswith('_'))
    only = os.environ.get('GUIDE_ONLY')
    if only:
        keep = [x.strip() for x in only.split(',')]
        files = [f for f in files if any(os.path.basename(f).startswith(k) for k in keep)]
    nav, opts, body, toc = [], [], [], []
    current_part, chap = None, 0
    for f in files:
        name = os.path.basename(f)
        prefix = int(name.split('-')[0])
        part = part_for(prefix)
        s = read(f)
        if '<!--GLOSSARY-->' in s: s = s.replace('<!--GLOSSARY-->', glossary_html())
        m = re.search(r'<section\s+id="([^"]+)"([^>]*)>', s)
        if not m: print('!! no <section id> in', name); continue
        sid, attrs = m.group(1), m.group(2)
        tm = re.search(r'data-title="([^"]+)"', attrs)
        h2 = re.search(r'<h2[^>]*>(.*?)</h2>', s, re.S)
        title = tm.group(1) if tm else (re.sub('<[^>]+>', '', h2.group(1)).strip() if h2 else sid)
        if part[2] != current_part:
            current_part = part[2]
            if part[2] != 'front':
                body.append(f'<div class="part-head" id="{part[2]}"><div class="pn">{part[3]}</div><h2>{part[4]}</h2><p>{part[5]}</p></div>')
                opts.append(f'<option value="{part[2]}">{part[3]}: {part[4]}</option>')
            nav.append(f'<div class="ptitle">{(part[3] + " · ") if part[3] else ""}{part[4]}</div>')
            toc.append(f'<li class="tp">{(part[3] + ": ") if part[3] else ""}{part[4]}</li>')
        chap += 1
        label = f'{part[3]} · Chapter {chap}' if part[3] else 'Introduction'
        s = s.replace(m.group(0), m.group(0) + f'\n<div class="sn">{label}</div>', 1)
        body.append(s)
        nav.append(f'<a href="#{sid}"><span>{chap}</span>{html.escape(title)}</a>')
        opts.append(f'<option value="{sid}">&nbsp;&nbsp;{chap}. {html.escape(title)}</option>')
        toc.append(f'<li><span>{chap}</span>{html.escape(title)}</li>')

    content = '\n'.join(body)
    # inline figures
    def fig(mm):
        p = os.path.join(SRC, 'figs', mm.group(1))
        if not os.path.exists(p): print('!! missing figure', mm.group(1)); return mm.group(0)
        mime = 'image/svg+xml' if p.endswith('.svg') else 'image/png'
        return 'src="' + b64(p, mime) + '"'
    content = re.sub(r'src="figs/([^"]+)"', fig, content)

    hero = read(os.path.join(SRC, 'hero.html')) if os.path.exists(os.path.join(SRC, 'hero.html')) else ''
    page = f'''<div class="topbar">
  <a class="brand" href="#top"><span class="logo">FM</span><span class="bt">{TITLE}</span></a>
  <div class="grow"><button class="searchbtn" id="searchbtn" type="button"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><span class="t">Search the guide…</span><kbd>⌘K</kbd></button></div>
  <select id="jp" aria-hidden="true" tabindex="-1"><option value="top">Top</option>{''.join(opts)}</select>
  <div class="layers" role="group" aria-label="Reading depth">
    <button data-layer="eli5" aria-pressed="true"><i style="background:var(--eli5)"></i>Plain</button><button data-layer="lead" aria-pressed="false"><i style="background:var(--lead)"></i>Leader</button><button data-layer="deep" aria-pressed="false"><i style="background:var(--deep)"></i>Deep</button><button data-layer="all" aria-pressed="false">All</button>
  </div>
  <button class="iconbtn" id="tt" type="button" aria-label="Toggle dark mode"></button>
  <div class="progress"><div id="pf"></div></div>
</div>
<div class="wrap">
<nav class="rail" aria-label="Chapters">{''.join(nav)}</nav>
<main id="top">
{hero}
<div class="print-only ptoc"><h2>Contents</h2><ol>{''.join(toc)}</ol></div>
{content}
<footer class="site">Built from three earlier study guides plus new training chapters. Numbers in worked examples are illustrative unless a source is named. Source and build script live in the accompanying repository.</footer>
</main>
</div>'''

    tag = os.environ.get('GUIDE_TAG', str(os.getpid()))
    tmp_in, tmp_out, tmp_css = f'/tmp/_g_in_{tag}.html', f'/tmp/_g_out_{tag}.html', f'/tmp/_g_mjx_{tag}.css'
    open(tmp_in, 'w', encoding='utf-8').write(page)
    r = subprocess.run(['node', os.path.join(ROOT, 'tools', 'render.js'), tmp_in, tmp_out, tmp_css], cwd=ROOT)
    if r.returncode: sys.exit('render failed')
    page = read(tmp_out)
    mjx_css = read(tmp_css)

    scripts = [read(os.path.join(SRC, 'core.js'))]
    for f in sorted(glob.glob(os.path.join(SRC, 'legacy', '*.js'))) + sorted(glob.glob(os.path.join(SRC, 'widgets', '*.js'))):
        nm = os.path.relpath(f, SRC)
        scripts.append(f";(function(){{try{{\n{read(f)}\n}}catch(e){{console.error('{nm}',e)}}}})();")
    scripts.append(read(os.path.join(SRC, 'ui.js')))
    js = '\n'.join(scripts)

    css = fonts_css() + '\n' + read(os.path.join(SRC, 'styles.css')) + '\n' + mjx_css + '\n' + \
        'mjx-container[jax="SVG"][display="true"]{overflow-x:auto;overflow-y:hidden;max-width:100%;padding:2px 0}\n' + \
        '.glossary .gl{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;padding:9px 0;border-bottom:1px solid var(--line)}.glossary dt{font-weight:700}.glossary dd{margin:0;max-width:70ch}@media(max-width:640px){.glossary .gl{grid-template-columns:minmax(0,1fr);gap:2px}}'
    gl_js = "(function(){var q=document.getElementById('glq');if(!q)return;q.addEventListener('input',function(){var v=q.value.toLowerCase().trim();document.querySelectorAll('.glossary .gl').forEach(function(r){r.hidden=v&&r.textContent.toLowerCase().indexOf(v)<0;});});})();"

    head = f'<title>{TITLE}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<meta name="description" content="{html.escape(DESC)}">\n'
    frag = head + f'<style>\n{css}\n</style>\n{page}\n<script>\n{js}\n{gl_js}\n</script>\n'
    os.makedirs(DIST, exist_ok=True)
    if only:
        full_c = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' + head + f'<style>\n{css}\n</style>\n</head>\n<body>\n{page}\n<script>\n{js}\n{gl_js}\n</script>\n</body>\n</html>\n'
        out = os.path.join(DIST, f'check-{tag}.html'); open(out, 'w', encoding='utf-8').write(full_c); print('check build ->', out); return
    open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8').write(frag)
    full = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + \
        head + f'<style>\n{css}\n</style>\n</head>\n<body>\n{page}\n<script>\n{js}\n{gl_js}\n</script>\n</body>\n</html>\n'
    open(os.path.join(DIST, 'standalone.html'), 'w', encoding='utf-8').write(full)
    print(f'built {chap} chapters, {len(frag)/1e6:.2f} MB')
    if pdf:
        subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'pdf.py')], check=True)

if __name__ == '__main__':
    main(pdf='--pdf' in sys.argv)
