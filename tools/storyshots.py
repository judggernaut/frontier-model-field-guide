#!/usr/bin/env python3
"""Screenshot every step of every visual story in the given chapters, in light and dark.
   python3 tools/storyshots.py 34 35  -> /tmp/story-<story-id>-<step>-<theme>.png (one contact sheet per story: /tmp/story-<id>.png)"""
import os, subprocess, sys
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pref = sys.argv[1:]; tag = 's' + '-'.join(pref)
subprocess.run([sys.executable, os.path.join(ROOT, 'build.py')], env=dict(os.environ, GUIDE_ONLY=','.join(pref), GUIDE_TAG=tag), check=True, stdout=subprocess.DEVNULL)
path = os.path.join(ROOT, 'dist', f'check-{tag}.html')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1100, 'height': 900}, device_scale_factor=1)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + path); pg.wait_for_timeout(800)
    pg.add_style_tag(content='.story .step.on .a,.story .step.on .grow-x{animation:none!important;opacity:1!important;transform:none!important}')
    ids = pg.evaluate("[...document.querySelectorAll('.story')].map(s=>s.id)")
    for sid in ids:
        shots = []
        for theme in ('light', 'dark'):
            pg.evaluate(f"document.documentElement.setAttribute('data-theme','{theme}')")
            n = pg.evaluate(f"document.querySelectorAll('#{sid} .step').length")
            for i in range(n):
                pg.evaluate(f"(()=>{{const st=document.getElementById('{sid}');st.querySelectorAll('.step').forEach((s,j)=>s.classList.toggle('on',j=={i}))}})()")
                el = pg.query_selector(f'#{sid} .stage'); f = f'/tmp/story-{sid}-{i+1}-{theme}.png'; el.screenshot(path=f); shots.append(f)
        ims = [Image.open(f) for f in shots]; w = max(i.width for i in ims); h = sum(i.height for i in ims)
        sheet = Image.new('RGB', (w, h), 'white'); y = 0
        for im in ims: sheet.paste(im, (0, y)); y += im.height
        sheet.thumbnail((900, 6000)); sheet.save(f'/tmp/story-{sid}.png')
        print(f'{sid}: {len(shots)//2} steps -> /tmp/story-{sid}.png')
    b.close()
print('\n'.join(errs) if errs else 'no JS errors')
os.remove(path)
