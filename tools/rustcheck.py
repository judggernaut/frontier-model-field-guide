#!/usr/bin/env python3
"""Compile (and run, if it has fn main) every Rust snippet in the given chapters.
   python3 tools/rustcheck.py 20 21   -> prints each snippet's output next to the Python comments' expected values"""
import glob, html, os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pref = sys.argv[1:] or ['']
fails = 0; n = 0
for f in sorted(glob.glob(os.path.join(ROOT, 'src', 'sections', '*.html'))):
    name = os.path.basename(f)
    if not any(name.startswith(p) for p in pref): continue
    s = open(f, encoding='utf-8').read()
    for i, m in enumerate(re.finditer(r'<pre class="code" data-lang="rust"><code>([\s\S]*?)</code></pre>', s)):
        n += 1
        code = html.unescape(m.group(1))
        d = tempfile.mkdtemp(); src = os.path.join(d, 'main.rs'); out = os.path.join(d, 'a.out')
        has_main = re.search(r'\bfn\s+main\s*\(', code) is not None
        open(src, 'w').write(('' if has_main else '#![allow(dead_code)]\n') + code)
        args = ['rustc', '--edition', '2021', '-O', '-A', 'unused', src, '-o', out] if has_main else ['rustc', '--edition', '2021', '--crate-type', 'lib', '-A', 'unused', src, '--out-dir', d]
        r = subprocess.run(args, capture_output=True, text=True)
        tag = f'{name} rust#{i+1}'
        if r.returncode:
            fails += 1; print(f'FAIL compile {tag}\n{r.stderr[:1500]}'); continue
        if has_main:
            rr = subprocess.run([out], capture_output=True, text=True, timeout=60)
            print(f'ok   {tag}  output: ' + ' | '.join(rr.stdout.strip().splitlines()[:12]) + (f'  STDERR {rr.stderr[:300]}' if rr.returncode else ''))
            if rr.returncode: fails += 1
        else:
            print(f'ok   {tag}  (library code, compiled)')
print(f'{n} Rust snippets, {fails} failures')
sys.exit(1 if fails else 0)
