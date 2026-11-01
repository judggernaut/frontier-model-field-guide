#!/usr/bin/env python3
"""Preview one or more chapters in isolation and catch errors.
   python3 tools/check.py 34 35        -> builds only sections starting 34/35, reports TeX + JS errors,
                                          writes screenshots /tmp/check-<tag>-desktop.png and -phone-dark.png"""
import os, subprocess, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pref = sys.argv[1:]
tag = 'c' + '-'.join(pref)
env = dict(os.environ, GUIDE_ONLY=','.join(pref), GUIDE_TAG=tag)
subprocess.run([sys.executable, os.path.join(ROOT, 'build.py')], env=env, check=True)
path = os.path.join(ROOT, 'dist', f'check-{tag}.html')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1280, 'height': 1600})
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    pg.goto('file://' + path); pg.wait_for_timeout(1200)
    h = pg.evaluate('document.body.scrollHeight')
    pg.screenshot(path=f'/tmp/check-{tag}-desktop.png', full_page=True)
    pg.evaluate("document.documentElement.setAttribute('data-theme','dark');G.redraw()")
    pg.set_viewport_size({'width': 400, 'height': 1600}); pg.wait_for_timeout(500)
    over = pg.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
    pg.screenshot(path=f'/tmp/check-{tag}-phone-dark.png', full_page=True)
    b.close()
print('page height', h, '| horizontal overflow at 400px:', over)
print('\n'.join(errs) if errs else 'no JS errors')
print(f'screenshots: /tmp/check-{tag}-desktop.png  /tmp/check-{tag}-phone-dark.png')
