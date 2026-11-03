#!/usr/bin/env python3
"""Regenerate the fully worked Part VII chapters: 81 coding, 86 design prompts, 88 ML coding.
Runs the code tests first."""
import importlib, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
for t in ('swe.py', 'ml.py'):
    subprocess.run([sys.executable, os.path.join(HERE, t)], check=True, stdout=subprocess.DEVNULL)
import render
for mod, fname in [('content_coding', '81-coding.html'), ('content_sd', '86-sd-prompts.html'), ('content_ml', '88-ml-coding.html')]:
    m = importlib.import_module(mod)
    snips = render.load_snippets(*m.SNIPS)
    sid, nav, h2 = m.META
    html = render.chapter(sid, nav, h2, m.INTRO, m.EX, snips, getattr(m, 'OUTRO', ''))
    open(os.path.join(ROOT, 'src', 'sections', fname), 'w', encoding='utf-8').write(html)
    print('wrote', fname, len(m.EX), 'examples')
