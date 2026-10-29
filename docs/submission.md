# Submission text (Cerebral Valley form)

**Project name:** Keel

**Track:** Indie Developer *(or Startup, as decided by the team)*

**Problem statement:** Push the Frontier (software)

**One-liner:** A code-repair agent that knows when it should not be trusted. Meta Muse models propose
fixes; conformal risk control decides which are safe to auto-merge, with a guarantee on how often it's wrong.

**Description**
Coding agents now produce plausible patches faster than teams can review them. The bottleneck is no
longer generating fixes but deciding which ones are safe to merge without a human. Keel is a GitHub
Action that repairs failing tests and opens pull requests labelled AUTO-MERGE or NEEDS REVIEW.

Muse Spark and Muse Spark Open each sample candidate patches. Muse Spark then writes adversarial
tests aimed at where the candidates disagree. Keel scores each patch with a code-aware nonconformity
score: test outcomes, adversarial survival, diff size and locality, static-analysis deltas, agreement
across samples and across the two models, and token-level uncertainty that only the open-weights model
exposes. A conformal risk control layer calibrated on held-out bug fixes turns that score into a
decision. At a risk level you choose, wrong auto-merges stay below the bound. A Learn-then-Test mode
bounds the share of merged patches that are wrong. Everything else goes to a human with an explanation.

We evaluate on SWE-bench Lite and QuixBugs with a visible/hidden test split, over 200 random splits,
against merging whenever tests pass, model self-confidence, and an uncalibrated score. An interactive
dashboard shows the empirical error against the guaranteed bound as you drag the risk level.

**How we used Meta models**
- Muse Spark (Meta Model API): patch generation, adversarial test writing, PR explanations
- Muse Spark Open (open weights, Baseten): second generator; logprobs and reasoning length as uncertainty features
- Muse Glimmer (open weights): optional cheap triage and cost baseline
- Muse Code: see BUILD_LOG.md

**Links**
- Repo: https://github.com/feedofmri/keel
- Live site and dashboard: https://feedofmri.github.io/keel/
- Live demo repo: https://github.com/feedofmri/keel-demo
- What was built during the hackathon: https://github.com/feedofmri/keel/blob/main/HACKATHON.md

---

# X post (Most Viral)

> Our AI refuses to merge its own code. And it can prove it's right to. 🧵
>
> Keel: Meta's Muse Spark writes fixes, Muse Spark Open double-checks, Muse Spark attacks them with new tests, and conformal risk control decides what's safe to auto-merge.
>
> Pick 10% risk → ≤10% wrong merges. Guaranteed.
> 🎥 [video] · 🔗 feedofmri.github.io/keel
> #MetaAIHackathon @AIatMeta

(Attach the 30-second cut: hook → AUTO-MERGE PR → NEEDS REVIEW PR → slider.)
