# Hackathon provenance

Meta Global AI Developer Hackathon, building period **Oct 26 – Nov 4, 2026**.

## New work only
- **All code, data, documentation and media in this repository were created during the event.**
  The first commit of this repository is dated Oct 29, 2026, and every later commit is dated
  within the building period. The git history is the record.
- Before the event we only had the *idea* (the project pitch) and an outline of the plan. No code
  from before the event is in this repository, and no earlier repository or codebase is reused.

## What we built during the event
This list is updated as components land (with commit references):

| Component | Where | Built |
|-----------|-------|-------|
| Repair pipeline: sandbox, test runner, SEARCH/REPLACE edits, secret-scrubbed test runs | `keel/pipeline.py`, `keel/sandbox.py`, `keel/testing.py`, `keel/edits.py` | Oct 29 |
| Meta model clients (Muse Spark, Muse Spark Open, Muse Glimmer) with cost, logprob and cache handling | `keel/generators/` | Oct 29 |
| Adversarial tests written by Muse Spark | `keel/attack.py` | Oct 29 |
| Code-aware features, gates, nonconformity score, explanations | `keel/features.py`, `keel/scoring.py`, `keel/explain.py` | Oct 29 |
| Conformal risk control and Learn-then-Test, calibration artefact with fingerprint | `keel/conformal.py`, `keel/calibration.py` | Oct 29 |
| GitHub Action (CI failure, `/keel fix`, issue label) that opens labelled PRs | `action.yml`, `keel/github/` | Oct 29 |
| QuixBugs and SWE-bench Lite adapters, split runner, baselines, ablations | `keel/eval/` | Oct 29 |
| Benchmark workflows on GitHub Actions | `.github/workflows/benchmark-*.yml` | Oct 29 |
| Website: waterline hero, story, comparison, install; risk dashboard | `site/` | Oct 29 |
| Logo SVG (from the team's logo PNG), favicon | `site/assets/` | Oct 29 |
| Demo repo template, video motion graphics, docs | `examples/`, `docs/` | Oct 29 |

Exact dates and diffs: `git log --stat`.

## What we did not build (third-party)
Used only as declared dependencies or downloaded at run time, under their own licenses:
- Python libraries listed in `pyproject.toml` (numpy, httpx, pyflakes, pytest).
- Benchmarks, downloaded at run time and not redistributed: SWE-bench / SWE-bench Lite
  (MIT, Princeton NLP) and QuixBugs (MIT, Lin et al.).
- Meta models used through their APIs: Muse Spark (Meta Model API), Muse Spark Open and
  Muse Glimmer (open weights, served by inference partners).

## Tools used to build Keel
- **Muse Code** (Meta's coding agent): every use is logged in [`BUILD_LOG.md`](BUILD_LOG.md).
- **Claude Code**, an AI coding assistant. Commits it helped write carry a `Co-Authored-By` trailer.
