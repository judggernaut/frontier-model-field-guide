#!/usr/bin/env python3
"""Import the standalone "RL Infra System Design" page into Part VII of the guide.

  python3 tools/import_rl_sysdesign.py "/path/to/RL Infra System Design.html"

Writes
  src/sections/82-sd-method.html     §1–§4  (the round, reference design, requirements, numbers)
  src/sections/83-sd-blocks.html     §5–§10 (vLLM, PyTorch, Ray, sandboxes, weight sync, control plane)
  src/sections/84-sd-worked.html     §11–§17 (seven worked problems)
  src/sections/85-sd-drills.html     §18–§20 + sources (pushback, failure, numbers drills)
  src/glossary/82-sd.json            the source glossary
  src/widgets/82-sd.js               the capacity planner (W1), failure chart (C1) and drill toggles
  src/css/rlx.css                    the source stylesheet, scoped under .rlx

Each generated chapter starts with hand-written framing kept in src/sections/_sd-intros/NN.html
(Plain words / For leaders layers); the imported body sits inside <div class="rlx">, always visible.
Math is converted from KaTeX back to TeX so the build pre-renders it like every other chapter.
Re-running is safe: generated files are overwritten, intros are not touched.
"""
import json, os, re, sys
from bs4 import BeautifulSoup, NavigableString

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')

CHAPTERS = [  # file prefix, section id, nav title, chapter h2, source section ids
    ('82', 'sd-method', 'System design: the method',
     'ML-systems design: the 45-minute method and the numbers', ['tldr', 's1', 's2', 's3', 's4']),
    ('83', 'sd-blocks', 'System design: building blocks',
     'ML-systems design: the building blocks on real libraries', ['s5', 's6', 's7', 's8', 's9', 's10']),
    ('84', 'sd-worked', 'System design: worked problems',
     'ML-systems design: seven worked problems', ['s11', 's12', 's13', 's14', 's15', 's16', 's17']),
    ('85', 'sd-drills', 'System design: drills',
     'ML-systems design: pushback, failure and numbers drills', ['s18', 's19', 's20', 'sources']),
]
FIELD_GUIDE = 'https://claude.ai/artifact/AbUPRz8w2pURfYbthYsiBn'

# ---------------------------------------------------------------- CSS scoping
DROP = re.compile(r'(^|[\s>+~,(])(html|body|main|h1)\b|\.(toc|rail|topbar|drawer|tb-|skip|page\b|hero|contents|kicker|dek|foot\b|part\b|part-no)')

def split_blocks(css):
    """Yield (prelude, body) for top-level blocks; body is raw text inside braces."""
    i, n, out = 0, len(css), []
    while i < n:
        j = css.find('{', i)
        if j < 0: break
        prelude = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{': depth += 1
            elif css[k] == '}': depth -= 1
            k += 1
        out.append((prelude, css[j + 1:k - 1]))
        i = k
    return out

def scope_sel(sel):
    sel = sel.strip()
    if not sel: return None
    if sel.startswith(':root'):
        rest = sel[len(':root'):]
        return (':root' + rest + ' .rlx') if rest else '.rlx'
    if DROP.search(sel): return None
    return '.rlx ' + sel

def scope(css):
    out = []
    for pre, body in split_blocks(css):
        if pre.startswith('@font-face') or pre.startswith('@import'): continue
        if pre.startswith('@media') or pre.startswith('@supports'):
            if 'print' in pre: continue
            inner = scope(body)
            if inner.strip(): out.append(f'{pre}{{{inner}}}')
            continue
        if pre.startswith('@'):
            out.append(f'{pre}{{{body}}}'); continue
        sels = [s for s in (scope_sel(x) for x in pre.split(',')) if s]
        if sels: out.append(','.join(sels) + '{' + body.strip() + '}')
    return '\n'.join(out)

def build_css(src_html):
    css = re.findall(r'(?s)<style>(.*?)</style>', src_html)[1]
    css = re.sub(r'(?s)/\*.*?\*/', '', css)
    # fonts: use the guide's embedded families instead of Google Fonts
    css = re.sub(r'--f-display:[^;]+;', '--f-display:var(--font-display);', css)
    css = re.sub(r'--f-body:[^;]+;', '--f-body:var(--font-body);', css)
    css = re.sub(r'--f-mono:[^;]+;', '--f-mono:var(--font-mono);', css)
    out = scope(css)
    # neutralise guide rules that share class names with the import
    out += '''
.rlx{font-family:var(--f-body);color:var(--ink);--measure:100%;--wide:100%}
.rlx .sec{margin:2.4rem 0 0;padding:0;border:0}
.rlx .widget{border-radius:12px}
.rlx .note,.rlx .qa{background:transparent}
.rlx mjx-container[display="true"]{margin:.4rem 0}
.rlx .mblock{overflow-x:auto}
.rlx .dscroll{overflow-x:auto}
.rlx svg text{font-family:var(--f-body)}
'''
    return out

# ---------------------------------------------------------------- HTML conversion
def katex_to_tex(soup):
    for disp in soup.select('span.katex-display'):
        ann = disp.find('annotation')
        tex = ann.get_text() if ann else ''
        disp.replace_with(NavigableString('\\[' + tex + '\\]'))
    for k in soup.select('span.katex'):
        ann = k.find('annotation')
        tex = ann.get_text() if ann else k.get_text()
        k.replace_with(NavigableString('\\(' + tex + '\\)'))

def rewrite_links(soup, sec_to_chapter):
    for a in soup.find_all('a', href=True):
        h = a['href']
        if h.startswith('#'):
            tgt = h[1:]
            if tgt == 'glossary': a['href'] = '#glossary'
            elif tgt in sec_to_chapter: a['href'] = '#rl-' + tgt
        elif h.startswith(FIELD_GUIDE):
            a['target'] = '_blank'; a['rel'] = 'noopener'
    for el in soup.find_all(id=True):
        i = el['id']
        if re.fullmatch(r's\d+(-h)?|tldr(-h)?|sources(-h)?|part\d', i):
            el['id'] = 'rl-' + i

def code_blocks(soup):
    """Source code sits in <pre class="code"> with spans; the guide highlights plain text itself."""
    for pre in soup.select('pre'):
        txt = pre.get_text()
        cap = None
        new = soup.new_tag('pre', attrs={'class': 'code', 'data-lang': 'python'})
        c = soup.new_tag('code'); c.string = txt.rstrip('\n'); new.append(c)
        pre.replace_with(new)

def main(path):
    raw = open(path, encoding='utf-8').read()
    os.makedirs(os.path.join(SRC, 'css'), exist_ok=True)
    open(os.path.join(SRC, 'css', 'rlx.css'), 'w').write(build_css(raw))

    soup = BeautifulSoup(raw, 'html.parser')
    katex_to_tex(soup)
    sec_to_chapter = {sid: ch[1] for ch in CHAPTERS for sid in ch[4]}
    rewrite_links(soup, sec_to_chapter)
    code_blocks(soup)

    # TL;DR becomes a plain block, not a nav section
    for pre, sid, nav, title, ids in CHAPTERS:
        parts = []
        for s in ids:
            el = soup.find(id='rl-' + s)
            if el is None: print('missing', s); continue
            if s == 'sources':
                el['class'] = (el.get('class') or []) + ['sec']
            parts.append(str(el))
        intro_p = os.path.join(SRC, 'sections', '_sd-intros', pre + '.html')
        intro = open(intro_p, encoding='utf-8').read() if os.path.exists(intro_p) else ''
        body = '\n'.join(parts)
        out = (f'<!-- GENERATED by tools/import_rl_sysdesign.py from "RL Infra System Design". '
               f'Edit src/sections/_sd-intros/{pre}.html for the framing; re-run the importer for the body. -->\n'
               f'<section id="{sid}" data-title="{nav}">\n<h2>{title}</h2>\n{intro}\n'
               f'<div class="rlx">\n{body}\n</div>\n</section>\n')
        open(os.path.join(SRC, 'sections', f'{pre}-{sid}.html'), 'w', encoding='utf-8').write(out)
        print('wrote', f'{pre}-{sid}.html', len(out) // 1024, 'KB')

    # glossary
    g = soup.find(id='glossary')
    terms = []
    if g:
        for dt in g.find_all('dt'):
            dd = dt.find_next_sibling('dd')
            d = dd.decode_contents().strip() if dd else ''
            terms.append({'term': dt.get_text(' ', strip=True), 'def': d, 'see': 'sd-method'})
    os.makedirs(os.path.join(SRC, 'glossary'), exist_ok=True)
    json.dump(terms, open(os.path.join(SRC, 'glossary', '82-sd.json'), 'w'), indent=1, ensure_ascii=False)
    print('glossary terms', len(terms))

    # widget JS: keep the model, helpers, W1, C1 and drills; drop page chrome
    js = re.findall(r'(?s)<script[^>]*>(.*?)</script>', raw)[0]
    js = js.split('// Links from the companion guide')[0]
    js = re.sub(r'\[initTheme, initDrawer, initScrollSpy, initDrills, initW1, initC1\]',
                '[initDrills, initW1, initC1]', js)
    js = js.replace("if (typeof module !== 'undefined' && module.exports) module.exports = CAP;", '')
    open(os.path.join(SRC, 'widgets', '82-sd.js'), 'w').write(
        '// GENERATED by tools/import_rl_sysdesign.py. Capacity planner, failure chart, drill toggles.\n' + js)

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Downloads/RL Infra System Design.html'))
