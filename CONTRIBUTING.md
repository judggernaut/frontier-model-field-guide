# Author spec

Everything in `src/` is assembled by `build.py` into one self-contained page. Follow this exactly so chapters look and behave the same.

## Files

- One chapter = one file `src/sections/NN-slug.html`. `NN` sets order and part:
  `00–09` front, `10–19` Part I statistics, `20–29` Part II evaluation, `30–49` Part III training, `50–59` Part IV leading.
- The file contains exactly one `<section id="slug" data-title="Short nav title">…</section>`. The build adds the chapter number; start with an `<h2>`.
- Widget code for a chapter goes in `src/widgets/NN-slug.js`. The build wraps each file in its own scope.
- Glossary terms go in `src/glossary/NN-slug.json` as `[{"term": "KL divergence", "def": "One sentence, HTML allowed.", "see": "section-id"}]`.
- Figures: `src/figs/name.png|svg`, referenced as `<img src="figs/name.png" alt="…">`. The build inlines them.

## Section skeleton

Every chapter is layered. Content outside layers is always shown; the top bar lets readers hide two of the three layers.

```html
<section id="sft" data-title="Supervised fine-tuning">
<h2>Supervised fine-tuning: teaching the format</h2>
<p>One or two framing sentences that are always visible.</p>

<div class="layer eli5"><div class="lh"><span class="badge">Plain words</span><span class="lt">A short heading</span></div>
  <p>Analogy first, no jargon, no formulas. Define any term you must use.</p>
</div>

<div class="layer lead"><div class="lh"><span class="badge">For leaders</span><span class="lt">A short heading</span></div>
  <p>What decision this informs, costs and trade-offs, failure modes, what good looks like, the questions to ask in a review.</p>
</div>

<div class="layer deep"><div class="lh"><span class="badge">Under the hood</span><span class="lt">A short heading</span></div>
  <p>Math, derivations, code, numbers.</p>
</div>
</section>
```

A long chapter may repeat the pattern under several `<h3>` subtopics, or use one set of three layers per subtopic. Widgets can sit inside a layer or between layers.

## Building blocks

- Callouts: `<div class="callout KIND"><span class="tag">Label</span><div>…</div></div>` with KIND one of
  `key` (key idea), `eval` (eval lens: what this means for measurement), `warn` (watch out), `ask` (questions a principal asks / interview question), `example` (worked problem), `eli5`, `note`.
  Labels: "Key idea", "Eval lens", "Watch out", "Principal asks", "Worked problem", "Note".
- Math: inline `\( … \)`, display `<div class="eq">\[ … \]<span class="eqcap">What each symbol means.</span></div>`. TeX is pre-rendered to SVG. Write `&lt;` for `<` inside HTML text.
- Code: `<pre class="code" data-lang="python"><code>…escaped code…</code></pre>`. Escape `<`, `>`, `&`. Keep code short and runnable; comments explain the why.
- Tables: wrap in `<div class="tw"><table>…</table></div>`. Use `td.n` for numbers.
- Tiles: `<div class="four"><div class="tile"><h4>…</h4><p>…</p></div>…</div>`.
- Steps: `<ol class="steps"><li><div>…</div></li></ol>`.
- Pipeline strip: `<div class="pipeline"><div class="stage"><b>Name</b>note</div>…</div>`.
- Collapsible Q&A: `<details class="qa"><summary>Question</summary><p>Answer</p></details>`.

## Widgets

Markup:

```html
<div class="widget" id="w-lora-params">
  <div class="wtitle">LoRA parameter budget</div>
  <div class="wsub">One sentence on what to try.</div>
  <div class="controls">
    <div class="ctl"><label for="lp-r">Rank r: <output id="lp-r-o">8</output></label><input type="range" id="lp-r" min="1" max="128" step="1" value="8"></div>
  </div>
  <canvas></canvas>   <!-- or an <svg> you fill from JS -->
  <div class="cards">…<div class="mc"><div class="l">Label</div><div class="v" data-x>…</div></div></div>
  <div class="readout" data-out></div>
</div>
```

Script (`src/widgets/NN-slug.js`):

```js
G.widget('w-lora-params', function (root) {
  var r = G.$(root, '#lp-r'), out = G.$(root, '[data-out]'), cv = G.$(root, 'canvas');
  function draw() {
    var P = G.pal();                       // theme colours, re-read on every draw
    var c = G.canvas(cv, 220), ctx = c.ctx; // DPR-aware canvas sized to its container
    var s = G.axes(ctx, c.w, c.h, {l:44,r:12,t:12,b:34}, {x:[0,128], y:[0,1], xt:[0,32,64,96,128], yt:[0,.5,1], xl:'rank', yl:'share'});
    G.line(ctx, [[s.X(0), s.Y(0)], [s.X(128), s.Y(1)]], P.accent, 2);
    out.textContent = '…';
  }
  G.on(r, 'input', draw);
  return draw;                              // called at start, on resize, on theme change
});
```

Rules: ids are unique across the whole page (prefix with the chapter slug). Every displayed number goes through `G.fmt`, `G.pct`, `G.big` or `G.sci`. Colours come from `G.pal()` (canvas) or `var(--token)` (SVG/HTML), never literals, so both themes work. Deterministic randomness: `G.rng(seed)`. Helpers: `G.gauss, G.erf, G.ncdf, G.quantile, G.mean, G.sum, G.softmax, G.sigmoid, G.text, G.dot, G.line`. No external libraries, no network calls, no `alert`. Widgets must render a sensible default state with no interaction, because the PDF prints that state.

Palette tokens: `fg muted faint line bg surface sunk accent tp fp fn tn roc pr eli5 lead deep good warn` and `series[0..5]`. Keep the TP/FP/FN/TN colours for those meanings only.

## Voice

- Plain, direct sentences. Active voice. No em-dash asides, no "not X but Y" framing, no "it's worth noting".
- Every layer earns its place: plain words never use unexplained jargon; leader layer is about decisions, cost, risk, and what to ask; deep layer is precise and correct.
- Tie training topics back to evaluation with at least one `callout eval` per chapter.
- Accuracy matters more than breadth. When citing a number from the literature, name the source (paper and year). When a number is illustrative, say so.
- Remove anything specific to one person's job history or interview. This guide is general.

## Visual stories (step-through diagrams)

The guide's main visual device. A story is a short sequence of SVG pictures, each with a one or two sentence caption, that walks a reader through an idea using an everyday example (mail sorting, a bakery, a sports scout, a GPS, exam grading). ui.js turns it into a card with Back / Next / Play and progress dots. The PDF prints every step.

```html
<div class="story" id="st-sft-apprentice">
  <div class="story-head"><div class="story-title">From well-read to well-mannered</div><p class="story-sub">How fine-tuning changes behaviour, told as a new hire's first month.</p></div>
  <div class="step">
    <svg viewBox="0 0 640 260" role="img" aria-label="Short description of the picture">
      <g class="a" style="--d:0"> …shapes… </g>          <!-- class="a" fades/rises in; --d sets order (180ms steps) -->
      <rect class="grow-x" style="--d:2" …/>               <!-- grows from the left, for bars -->
      <path class="dash" …/>                                <!-- marching-ants line, for flows -->
      <circle class="pulse" …/>                             <!-- gentle pulse, for "look here" -->
      <text x="320" y="240" text-anchor="middle" font-size="14" fill="var(--fg)">Label</text>
    </svg>
    <p>Caption: what this picture shows and why it matters, in plain words.</p>
  </div>
  …3 to 7 steps…
</div>
```

Rules: viewBox 640 wide (height 220–300). Colours only through CSS variables in attributes (`fill="var(--accent)"`, `stroke="var(--line-strong)"`), using the palette tokens (`fg muted faint line line-strong surface sunk accent accent-soft tp fp fn tn eli5 eli5-soft lead lead-soft deep deep-soft good good-soft warn warn-soft`). Text at least 12px, never touching shapes, inside the viewBox. Each step adds one idea; the last step lands the takeaway. Use real-feeling numbers. No external images.
