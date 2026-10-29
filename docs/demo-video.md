# Demo video (3:00)

Motion-graphics segments are rendered from [`docs/video/scenes.html`](video/scenes.html) to
`docs/video/out/*.mp4` (`python3 -m http.server 8766` from the repo root, then `node docs/video/render.js`).
**Re-render after the real benchmark run** so the guarantee scene shows real numbers.
Everything else is a screen recording of the real product.

| Time | Visual | Voice-over |
|------|--------|-----------|
| 0:00–0:08 | `hook.mp4`: PRs pile up | "Coding agents now write patches faster than anyone can review them. So which ones can you merge without looking?" |
| 0:08–0:20 | `pipeline.mp4` (first half) | "Keel is a code-repair agent that knows when it shouldn't be trusted. Meta's Muse Spark and Muse Spark Open generate candidate fixes…" |
| 0:20–0:32 | `pipeline.mp4` (second half) | "…then Muse Spark writes adversarial tests to attack them, and Keel scores every patch and decides, with a statistical guarantee." |
| 0:32–1:05 | **Screen:** `keel-demo` repo. Apply `bugs/01-discount-backwards.patch`, push, CI goes red, Keel workflow starts (speed up 4×) | "Here's a real repo. I push a bug. CI fails, and Keel kicks in on a free GitHub runner." |
| 1:05–1:30 | **Screen:** the Keel PR with the green **AUTO-MERGE** label; scroll the explanation and candidate table | "One minute later: a pull request, labelled AUTO-MERGE. Both Meta models agreed, it survived every adversarial test, and its risk score is under the calibrated threshold." |
| 1:30–1:55 | **Screen:** apply `bugs/02-shipping-rules.patch` → the **NEEDS REVIEW** PR. Highlight "passes every visible test" and "fails adversarial tests" | "Now a nastier bug. This patch passes every visible test, so most agents would ship it. Keel says NEEDS REVIEW and tells the reviewer exactly why." |
| 1:55–2:25 | **Screen:** dashboard. Drag α from 5% to 30%; switch CRC/LTT; hover the chart | "This is the guarantee. Pick a risk level. On held-out SWE-bench and QuixBugs bugs, Keel's real error stays under the bound, while 'merge if tests pass' and model self-confidence blow straight through it." |
| 2:25–2:40 | `guarantee.mp4` or the dashboard's model and ablation tables | "Muse Spark Open's token probabilities, signals only open weights expose, raise how much Keel can safely merge, at a fraction of the cost." |
| 2:40–3:00 | `end.mp4` | "Everything you saw was built this week. Keel: Meta models propose, conformal risk control decides." |

## Recording checklist
- [ ] Benchmarks finished; dashboard shows real data (no preview banner)
- [ ] `keel-demo` has the secrets, the calibration file and Actions write permission
- [ ] Do a dry run of both bugs before recording (model outputs vary; keep the best take)
- [ ] 1080p, browser zoom 125%, dark theme, notifications off
- [ ] Under 3:00; captions burned in; upload as unlisted YouTube/Vimeo, check it plays logged out
