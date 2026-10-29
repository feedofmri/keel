<p align="center">
  <img src="web/public/logo.svg" width="72" alt="Keel logo">
</p>

<h1 align="center">Keel</h1>
<p align="center"><b>A code-repair agent that knows when it should not be trusted.</b></p>
<p align="center">
  <a href="https://keel.boraqs.com">keel.boraqs.com</a> ·
  <a href="https://feedofmri.github.io/keel/">Preview (GitHub Pages)</a> ·
  <a href="https://feedofmri.github.io/keel/results">Results</a> ·
  <a href="#install-as-a-github-action">Install</a> ·
  <a href="HACKATHON.md">What we built at the hackathon</a>
</p>

---

Coding agents now produce plausible patches faster than teams can review them. The bottleneck is no
longer *generating* fixes but *deciding which ones are safe to merge without a human*.

Keel uses **Meta's Muse models** to generate candidate patches for failing tests. Then:

1. Muse Spark **writes adversarial tests** aimed at where the candidates disagree.
2. Keel scores each patch with a **code-aware nonconformity score**: test outcomes, adversarial survival,
   diff size and locality, static-analysis deltas, self-consistency across samples and across models,
   and token-level uncertainty from the open-weights model.
3. A **conformal risk control** layer, calibrated on held-out bug fixes, turns the score into a decision
   with a distribution-free guarantee: at a risk level you choose (say 10%), wrong auto-merges stay
   below that bound.
4. Keel opens a pull request labelled **AUTO-MERGE** or **NEEDS REVIEW**, with an explanation.

> Built for the Meta Global AI Developer Hackathon 2026 (*Push the Frontier*, software). All code in
> this repository was written during the event. See [`HACKATHON.md`](HACKATHON.md).

## How Meta's models are used

| Model | Access | Role |
|-------|--------|------|
| **Muse Spark** | Meta Model API | Main patch generator; writes the adversarial tests; optional plain-English PR explanation |
| **Muse Spark Open** (`meta-models/muse-spark-open-1026`) | Open weights via Baseten (or any OpenAI-compatible partner) | Second generator for diversity; **token logprobs and reasoning length** become uncertainty features, which only open weights expose |
| **Muse Glimmer** | Open weights via a partner | Optional cheap triage that sets the sample budget; cost baseline in the evaluation |

Every model goes through one OpenAI-compatible client, so changing provider is a configuration change.

## The guarantee

Calibration data: *n* held-out bugs, each with the risk score *sᵢ* of Keel's selected patch and a label
*wrongᵢ* from **hidden tests the agent never saw**. Keel auto-merges when *s ≤ λ̂*.

* **CRC (default):** λ̂ = max{λ : (Σᵢ wrongᵢ·1[sᵢ ≤ λ] + 1)/(n + 1) ≤ α}. Then
  **E[1{auto-merged and wrong}] ≤ α**: on average, at most α of bugs get a wrong patch auto-merged
  (Angelopoulos et al., *Conformal Risk Control*, 2022).
* **LTT:** each threshold on a fixed grid is tested with an exact binomial test (Bonferroni). Then
  **with probability ≥ 1 − δ, at most α of auto-merged patches are wrong**
  (Angelopoulos et al., *Learn then Test*, 2021).

Assumptions are stated in every PR. Calibration and deployment bugs must be exchangeable, so Keel
fingerprints its models, prompts and scorer and refuses to auto-merge on a stale calibration. With no
calibration at all, Keel never auto-merges.

`tests/test_conformal.py` checks both guarantees by simulation on every CI run.

## The Keel platform

At [keel.boraqs.com/app](https://keel.boraqs.com/app/), sign in with GitHub, pick a repository and
set a risk level. Keel stores your Meta model keys as encrypted repository secrets and opens one setup
pull request. After you merge it, every run shows up on the repository's dashboard. The code is in
[`platform/`](platform/) (Node.js, Fastify, PostgreSQL), and deployment is described in
[`docs/cpanel-setup.md`](docs/cpanel-setup.md). The web app is React in [`web/`](web/); the GitHub Pages
copy is the same build in demo mode with sample data.

## Quick start (local)

```bash
pip install git+https://github.com/feedofmri/keel
keel doctor                      # which Meta model endpoints are configured
keel repair --repo path/to/repo  # discover failing tests, repair, print the PR body
```

Offline demo with canned model responses (no API keys):

```bash
keel repair --repo examples/demo_repo --cache "" \
  --models scripted:muse-spark:examples/responses/muse-spark.json,scripted:muse-spark-open:examples/responses/muse-spark-open.json \
  --attacker scripted:attacker:examples/responses/attacker.json
```

## Install as a GitHub Action

Copy [`examples/workflows/keel.yml`](examples/workflows/keel.yml) to `.github/workflows/keel.yml`
and add your model keys as repository secrets. Keel runs when CI fails, or when someone with write
access comments `/keel fix`. Configure it with [`.keel.toml`](examples/keel-demo/.keel.toml).
Secrets are scrubbed from the environment of any code a model wrote, and edits to tests or CI are
hard-blocked.

## Evaluation

```bash
keel eval quixbugs  --models muse-spark,muse-spark-open --k 5    # 40 programs, visible/hidden split
keel eval swebench  --n 100 --stage all                          # SWE-bench Lite, official harness
keel eval analyze   results/quixbugs/records.jsonl --out web/public/data/results.json
keel calibrate      results/quixbugs/records.jsonl --out calibration.json
```

Both benchmarks also run from the Actions tab (`Benchmark – QuixBugs`, `Benchmark – SWE-bench Lite`).
Results feed the [results page](https://feedofmri.github.io/keel/results). It compares Keel with
merging whenever tests pass, with model self-confidence ≥ 1−α, and with Keel's own score without
calibration. It also shows per-model cost and feature ablations.

**Protocol.** Keel only sees half of the failing tests. A patch is *correct* iff it passes all hidden
tests (for SWE-bench: every FAIL_TO_PASS and PASS_TO_PASS test, in the official Docker harness). For
QuixBugs, a check confirms that the reference fix passes and the buggy program fails the hidden tests for
all 40 programs. Bugs are split into fit / calibration / test sets, repeated over 200 random splits.

## Repository map

| Path | What |
|------|------|
| `keel/pipeline.py` | Baseline → generate → attack → evaluate → score → decide |
| `keel/generators/` | OpenAI-compatible client with Meta model profiles; scripted generator |
| `keel/attack.py` | Adversarial test generation |
| `keel/features.py`, `keel/scoring.py` | Code-aware features, gates, nonconformity score |
| `keel/conformal.py`, `keel/calibration.py` | CRC and Learn-then-Test, calibration artefact |
| `keel/github/` | The GitHub Action entry point |
| `keel/eval/` | QuixBugs and SWE-bench adapters, split runner, simulation |
| `web/` | The web app (React): public pages, sign-in, and the app screens |
| `platform/` | The Keel platform API (Node.js, Fastify, PostgreSQL), which also serves `web/` |
| `examples/` | Demo repo, canned responses, workflow, live-demo template |

## License

MIT. QuixBugs and SWE-bench are downloaded at run time under their own MIT licenses and are not
redistributed.
