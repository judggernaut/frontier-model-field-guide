// Pre-renders TeX to inline SVG (MathJax) and highlights <pre class="code"> blocks (highlight.js).
// Usage: node tools/render.js in.html out.html out.css
const fs = require('fs');
const { mathjax } = require('mathjax-full/js/mathjax.js');
const { TeX } = require('mathjax-full/js/input/tex.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');
const hljs = require('highlight.js');

const [, , inFile, outFile, cssFile] = process.argv;
let src = fs.readFileSync(inFile, 'utf8');

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({ packages: AllPackages.filter(p => p !== 'bussproofs') });
const svg = new SVG({ fontCache: 'local' });
const doc = mathjax.document('', { InputJax: tex, OutputJax: svg });

const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
let nMath = 0, errors = [];
function renderMath(t, display) {
  const node = doc.convert(unesc(t).trim(), { display, em: 16, ex: 8, containerWidth: 720 });
  let out = adaptor.outerHTML(node);
  if (/data-mjx-error|merror/.test(out)) errors.push(t.slice(0, 120));
  nMath++;
  return out;
}

// 1) highlight code blocks first, protecting them from math
const protectedBlocks = [];
src = src.replace(/<pre class="code"([^>]*)><code>([\s\S]*?)<\/code><\/pre>/g, (m, attrs, code) => {
  const lm = attrs.match(/data-lang="([\w+-]+)"/);
  const lang = lm ? lm[1] : 'plaintext';
  let html;
  try { html = hljs.getLanguage(lang) ? hljs.highlight(unesc(code), { language: lang }).value : code; }
  catch (e) { html = code; }
  protectedBlocks.push(`<pre class="code"${attrs}><code>${html}</code></pre>`);
  return `\u0000P${protectedBlocks.length - 1}\u0000`;
});
// protect scripts, styles, inline svgs, textareas
src = src.replace(/<(script|style|svg|textarea)\b[\s\S]*?<\/\1>/g, m => { protectedBlocks.push(m); return `\u0000P${protectedBlocks.length - 1}\u0000`; });

// 2) math: display \[...\] then inline \(...\)
src = src.replace(/\\\[([\s\S]+?)\\\]/g, (m, t) => renderMath(t, true));
src = src.replace(/\\\(([\s\S]+?)\\\)/g, (m, t) => renderMath(t, false));

// 3) restore
src = src.replace(/\u0000P(\d+)\u0000/g, (m, i) => protectedBlocks[+i]);
src = src.replace(/\u0000P(\d+)\u0000/g, (m, i) => protectedBlocks[+i]);

fs.writeFileSync(outFile, src);
const css = adaptor.textContent(svg.styleSheet(doc));
fs.writeFileSync(cssFile, css);
console.error(`render: ${nMath} formulas, ${protectedBlocks.length} protected blocks, ${errors.length} TeX errors`);
errors.forEach(e => console.error('  TeX error near: ' + e));
