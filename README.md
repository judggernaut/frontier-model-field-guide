# Frontier Model Field Guide

Statistics, evaluation, and training for large language models, each topic layered from plain words to principal-level depth.

**Read it online:** https://judggernaut.github.io/frontier-model-field-guide/ · [PDF](https://judggernaut.github.io/frontier-model-field-guide/frontier-model-field-guide.pdf)

- **Part I, Statistical foundations**: distributions, sampling, standard error, intervals, p values, reading a shape, heavy tails.
- **Part II, Evaluating models**: pass-rate intervals, paired comparisons, power, multiple comparisons, classification metrics through ROC and PR AUC, LLM judges, the offline to online gap, contamination, harness engineering, regression triage, choosing a metric.
- **Part III, How neural networks and LLMs work**: neurons and layers, gradient descent, architecture design, the family tree through transformers and GNNs, next-token prediction, assistants, reasoning modes, one-pass decision models, and decision framing.
- **Part IV, Training models**: the pipeline, pretraining, optimisation, scaling laws, SFT, LoRA and PEFT, distillation and synthetic data, reward models, RLHF and PPO, DPO and its relatives, GRPO and RL with verifiable rewards, inference and test-time compute, safety training.
- **Part V, Leading the work**: connecting training and evaluation, reviewer checklists, red flags, and a glossary.
- **Part VI, Experimental design**: causation, sampling, randomization, measurement, A/B tests, metrics, and experiments for AI systems.
- **Part VII, Interviews (private)**: not part of the public guide; built to an unlisted page (see below). Contents: what Anthropic, OpenAI, Meta and Netflix loops test (from 2026 candidate reports), practical coding rounds with tested Python, and ML-systems design for RL infrastructure imported from the *RL Infra System Design* playbook (method, building blocks, seven worked problems, drills, reported prompts). Applied subsections in chapters 31, 34, 35, 44, 47 and 51 cover the interview-depth material (classical ML, FlashAttention and tokenization, RAG/tools/MCP/agent evals, KL in SFT, reward-design critique, the roofline).
- **Appendix**: SQL for eval data (logical query order, joins, subqueries, window functions, variance and two-SD outliers, practice problems), basic system design, and the glossary.

Every chapter has three layers (Plain words, For leaders, Under the hood) and most have interactive widgets. A switch in the top bar shows one layer at a time.

## Outputs

| File | What it is |
| --- | --- |
| `dist/standalone.html` | The whole guide as one self-contained HTML file. Open it in any browser, offline. |
| `dist/index.html` | The same page without the document wrapper, used for publishing as an artifact. |
| `dist/frontier-model-field-guide.pdf` | Print version. Widgets appear at their default settings. |
| `docs/` | GitHub Pages copy of the standalone page and PDF. After a rebuild, copy `dist/standalone.html` to `docs/index.html`. |

## Private Part VII

Chapters `80`–`89` are excluded from `index.html` and `standalone.html` and built into `dist/p7-interviews-4c9e1b.html` (override the name with `GUIDE_SECRET_PAGE`). Links from the public guide into Part VII are stripped; links from Part VII back to the guide point at `index.html#…`. The page carries `noindex,nofollow`, but it is only unlisted, not protected: anyone with the URL, or with access to this repository's `src/`, can read it.

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
tools/import_rl_sysdesign.py  regenerates chapters 82–85 from the RL Infra System Design HTML (framing in src/sections/_sd-intros/)
tools/gen_sql_story.py, tools/gen_sd_story.py  regenerate the step-through stories in the appendix chapters
tools/worked/               fully worked Part VII examples: swe.py and ml.py hold tested code (run them), content_*.py hold the write-ups, build_chapters.py regenerates chapters 81, 86 and 88
tools/reddit_fetch.py       reads Reddit posts by id through a proxy (anonymous app OAuth, sticky sessions)
src/css/*.css             extra stylesheets appended after styles.css (rlx.css scopes the imported playbook)
```

See `CONTRIBUTING.md` for the author spec: section skeleton, callout types, widget API, and voice.

## Sources

Built from two earlier study guides ("Statistics foundations for model evaluation" and the technical parts of a model-evaluation study guide), a precision-to-AUC explainer, and new training chapters. Literature numbers name their paper and year; worked-example numbers are illustrative unless a source is named.
