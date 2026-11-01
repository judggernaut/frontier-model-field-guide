# Frontier Model Field Guide

Statistics, evaluation, and training for large language models, each topic layered from plain words to principal-level depth.

- **Part I, Statistical foundations**: distributions, sampling, standard error, intervals, p values, reading a shape, heavy tails.
- **Part II, Evaluating models**: pass-rate intervals, paired comparisons, power, multiple comparisons, classification metrics through ROC and PR AUC, LLM judges, the offline to online gap, contamination, harness engineering, regression triage, choosing a metric.
- **Part III, How neural networks and LLMs work**: neurons and layers, gradient descent, architecture design, the family tree through transformers and GNNs, next-token prediction, assistants, reasoning modes, one-pass decision models, and decision framing.
- **Part IV, Training models**: the pipeline, pretraining, optimisation, scaling laws, SFT, LoRA and PEFT, distillation and synthetic data, reward models, RLHF and PPO, DPO and its relatives, GRPO and RL with verifiable rewards, inference and test-time compute, safety training.
- **Part V, Leading the work**: connecting training and evaluation, reviewer checklists, red flags, and a glossary.

Every chapter has three layers (Plain words, For leaders, Under the hood) and most have interactive widgets. A switch in the top bar shows one layer at a time.

## Outputs

| File | What it is |
| --- | --- |
| `dist/standalone.html` | The whole guide as one self-contained HTML file. Open it in any browser, offline. |
| `dist/index.html` | The same page without the document wrapper, used for publishing as an artifact. |
| `dist/frontier-model-field-guide.pdf` | Print version. Widgets appear at their default settings. |

## Build

```bash
npm install                      # MathJax, highlight.js, fonts
pip install playwright           # only for the PDF and checks
python3 build.py                 # -> dist/index.html, dist/standalone.html
python3 build.py --pdf           # also renders the PDF
python3 tools/check.py 34 35     # preview chapters 34 and 35 alone, report TeX/JS errors, screenshot
```

Math is typeset to SVG at build time and code is highlighted at build time, so the output has no runtime dependencies and no network calls. Fonts (Bricolage Grotesque, Atkinson Hyperlegible, JetBrains Mono) are embedded.

## Layout

```
src/
  sections/NN-slug.html   one chapter per file; NN sets order and part
  widgets/NN-slug.js      that chapter's interactive widgets (uses window.G helpers)
  glossary/*.json         glossary fragments, merged and sorted at build time
  legacy/                 widget code carried over from the two earlier study guides
  figs/                   figures, inlined at build time
  core.js  ui.js  styles.css  hero.html
tools/render.js           TeX -> SVG and code highlighting
tools/pdf.py              PDF rendering
tools/check.py            per-chapter preview and error check
```

See `CONTRIBUTING.md` for the author spec: section skeleton, callout types, widget API, and voice.

## Sources

Built from two earlier study guides ("Statistics foundations for model evaluation" and the technical parts of a model-evaluation study guide), a precision-to-AUC explainer, and new training chapters. Literature numbers name their paper and year; worked-example numbers are illustrative unless a source is named.
