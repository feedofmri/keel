# Competitive landscape: how Keel is better

Researched Oct 29, 2026. Keel is not trying to be another coding agent. It's the layer that decides
**whether an agent's fix can be trusted without a human**, with a number you can set as policy.
Nothing below does that end to end.

## The field

| Product / work | What it does | Strengths | Where it stops |
|---|---|---|---|
| **GitHub Copilot cloud agent: "Fix with Copilot"** (GA for all paid tiers, mid 2026) | One click on a failed Actions job: Copilot investigates, pushes a fix, *tags you for review* | Native to GitHub, strong models, zero setup | Every fix still goes to a human. No calibrated confidence, no risk policy, no evidence of how often it's wrong |
| **Sentry Seer + Copilot handoff** (GA June 2026) | Root-cause analysis on production errors, then hands off to Copilot to open a PR | Great at *finding* the bug from telemetry | Same ending: a PR waiting for review |
| **Devin, Cursor agents, Codex, Claude Code** | General coding agents that open PRs | High solve rates | Agent PRs are merged far less often than human PRs (≈65% vs 85% in one 220k-PR study; ≈33% vs 84% in LinearB's 2026 data). The trust gap is the open problem |
| **OpenHands (resolver, critic model)** | Open-source agent; a learned critic picks the best of N rollouts | Open, strong on SWE-bench Verified | The critic ranks patches but doesn't say *whether to trust the best one*. The standalone resolver was archived in Dec 2024 |
| **Agentless / SWE-RL "Agentless Mini"** | Sample patches, filter by regression tests, pick by consensus on reproduction tests | Simple, cheap, effective selection | Selection only. Always submits a patch, with no abstention and no error bound |
| **Patch-correctness assessment research** (APCA, LLM-based) | Classifiers predicting if a plausible patch is correct | Good signals for overfitting | Point predictions with no guarantee. Research code, not a product |
| **"Task Abstention for LLMs in Code Generation"** (arXiv 2605.17029, 2026) | Distribution-free abstention for code generation via multiple hypothesis testing on execution consistency | Closest statistical relative: a real guarantee | Function-level code generation, not repository repair. Single-model consistency only. No product, no PRs, no CI |
| **"When Can CRC Certify LLM Outputs?"** (arXiv 2606.29054, 2026) | Theory: when base risk μ > α, any distribution-free method must abstain on ≥ (μ−α)/(1−α) | Explains the limits honestly | Theory on NER/JSON/QA, not code |
| **Mend Renovate "Merge Confidence"** | Auto-merges *dependency updates* when crowd data says they're safe | The one widely-used product that auto-merges on confidence | Only version bumps. Crowd heuristics, no statistical guarantee. Can't judge new code |
| **Meta SapFix (2019) / TestGen-LLM (2024)** | Meta's own automated repair at scale; "Assured LLM-based SE": only ship changes that pass guarantees (build, pass, add coverage) | Proved assured LLM engineering works in production (73% of TestGen-LLM recommendations accepted) | SapFix's developers were the final gatekeepers. TestGen-LLM's assurance is a filter, not a statistical risk bound |

## Why Keel is better

1. **It decides, not just proposes.** Everyone else ends with "tagged you for review". Keel's output is
   AUTO-MERGE or NEEDS REVIEW, and that is what removes review load.
2. **The decision carries a guarantee you choose.** At α = 10%, wrong auto-merges stay at or under 10%
   (CRC, on average), or 10% of merges with probability 1−δ (LTT). No other product gives a
   distribution-free bound. The closest research covers function-level code generation without a product.
3. **Meta models cross-examine each other.** Muse Spark writes adversarial tests against the candidates.
   Agreement *between* Muse Spark and Muse Spark Open is a signal. Muse Spark Open's token logprobs are a
   signal only open weights expose. Competitors use one model, or rank with a critic trained on the same
   distribution.
4. **Selection *and* abstention.** Keel includes the selection signals others rely on: regression
   gates, test-outcome consensus as in Agentless/CodeT, agreement across samples. It then goes further and
   learns when even the best candidate isn't good enough.
5. **Honest by construction.** Correctness is measured on hidden tests the agent never saw. Edits to
   tests are hard-blocked. A stale calibration is refused. With no calibration Keel never auto-merges. Every
   PR states its assumptions. The dashboard shows the baselines breaking the bound.
6. **A real product with zero infrastructure.** It's one workflow file and runs on free GitHub runners.
   It works alongside Copilot, Devin or OpenHands: Keel can be the trust layer that decides which of
   *their* PRs need a human (roadmap).
7. **Meta lineage.** It's the next step after SapFix and TestGen-LLM: *Assured* LLM-based software
   engineering, where the assurance becomes a calibrated statistical guarantee on merge risk.

## Where others are ahead today, and how we close the gap

| Gap | Who's ahead | Keel's answer |
|-----|-------------|---------------|
| Raw solve rate on hard repo-level bugs | Copilot, Devin, OpenHands (bigger agent loops, tool use) | Keel's guarantee doesn't depend on the generator. Plugging in a stronger agent raises the auto-merge rate without touching the bound. We report solve@k honestly per Meta model |
| Root-cause analysis from production telemetry | Sentry Seer | Out of scope. Keel starts from failing tests |
| Zero-config polish inside GitHub's UI | Copilot | A one-file Action; labels and explanations show up natively on PRs |
| Calibration needs labelled data | everyone avoids the question | We ship a QuixBugs + SWE-bench calibration and a fingerprint guard. The dashboard shows how the bound tightens with *n*, and the CRC feasibility bound explains when Keel must abstain |

## The one-line pitch versus the field
> Copilot, Devin and OpenHands write the patch and hand it to you. Keel tells you which patches you
> don't need to look at, and proves it's right about that at least 90% of the time.

### Sources
- GitHub changelog: [one-click fixes for failing Actions with Copilot cloud agent](https://github.blog/changelog/2026-05-18-one-click-fixes-for-failing-actions-with-copilot-cloud-agent/), [Pro/Pro+/Max rollout](https://github.blog/changelog/2026-06-04-fix-with-copilot-for-failing-actions-now-in-pro-pro-and-max/), [mobile](https://github.blog/changelog/2026-07-23-github-mobile-fix-failing-actions-checks-with-copilot-cloud-agent)
- Sentry: [Seer hands off to GitHub Copilot (GA)](https://sentry.io/changelog/gh-copilot-agent-GA/)
- Merge rates: [Agent pull requests merge at 65%, humans at 85%](https://robertstowe.com/agent-pull-requests-merge-at-65-humans-at-85/), [LinearB 2026 data](https://linearb.io/library/ai-in-software-development), [AI agent PRs on GitHub (arXiv 2607.04697)](https://arxiv.org/abs/2607.04697v2)
- OpenHands: [critic model and inference-time scaling](https://www.all-hands.dev/blog/sota-on-swe-bench-verified-with-inference-time-scaling-and-critic-model), [archived resolver](https://github.com/All-Hands-AI/openhands-resolver/releases)
- Agentless Mini consensus: [SWE-RL (arXiv 2502.18449)](https://arxiv.org/pdf/2502.18449)
- Abstention / CRC for LLMs: [Task Abstention for LLMs in Code Generation (arXiv 2605.17029)](https://arxiv.org/html/2605.17029), [When Can Conformal Risk Control Certify LLM Outputs? (arXiv 2606.29054)](https://arxiv.org/abs/2606.29054)
- Patch correctness: [LLM for automatic patch correctness assessment (TSE 2024)](https://dl.acm.org/doi/10.1109/TSE.2024.3452252)
- Renovate: [Mend Merge Confidence](https://www.mend.io/blog/merge-confidence/)
- Meta: [SapFix (ICSE-SEIP 2019)](https://ieeexplore.ieee.org/abstract/document/8804442), [TestGen-LLM (arXiv 2402.09171)](https://arxiv.org/pdf/2402.09171)
