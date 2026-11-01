#!/usr/bin/env python3
"""Render dist/standalone.html to PDF with headless Chromium (light theme, print CSS)."""
import os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'dist', 'standalone.html')
OUT = os.path.join(ROOT, 'dist', 'frontier-model-field-guide.pdf')

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 900, 'height': 1200}, device_scale_factor=2)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("try{localStorage.setItem('guide-theme','light');localStorage.setItem('guide-layer','all')}catch(e){}")
    pg.goto('file://' + SRC, wait_until='load')
    pg.evaluate("document.documentElement.setAttribute('data-theme','light')")
    pg.emulate_media(media='print')
    pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(1500)
    pg.evaluate("G.redraw()")
    pg.wait_for_timeout(800)
    pg.pdf(path=OUT, format='Letter', print_background=True, outline=True, tagged=True,
           margin={'top': '0.6in', 'bottom': '0.7in', 'left': '0.6in', 'right': '0.6in'},
           display_header_footer=True,
           header_template='<div></div>',
           footer_template='<div style="width:100%;font-size:8px;color:#888;padding:0 0.6in;display:flex;justify-content:space-between;font-family:sans-serif"><span>Frontier Model Field Guide</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>')
    b.close()
    if errs: print('page errors:', errs[:10])
    print('pdf written', OUT, os.path.getsize(OUT) // 1024, 'KB')
