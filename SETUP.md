# Setup: what's needed to go live

Everything in this repository runs on GitHub (Pages for the site, Actions for Keel and the benchmarks).
These steps need the repository owner. **Never commit keys:** use repository secrets.

## 1. Turn on the website (2 minutes)
Settings → Pages → *Build and deployment* → Source: **GitHub Actions**.
Then re-run the **Deploy site** workflow (Actions tab). The site appears at
`https://feedofmri.github.io/keel/`.

## 2. Model access (Meta models)
Settings → Secrets and variables → Actions.

| Name | Kind | Value |
|------|------|-------|
| `KEEL_MUSE_SPARK_BASE_URL` | secret | Meta Model API base URL (OpenAI-compatible, ends before `/chat/completions`) |
| `KEEL_MUSE_SPARK_API_KEY` | secret | Meta Model API key |
| `KEEL_MUSE_SPARK_MODEL` | secret | Muse Spark model id |
| `KEEL_SPARK_OPEN_API_KEY` | secret | Baseten (or other partner) key for Muse Spark Open |
| `KEEL_SPARK_OPEN_BASE_URL` | variable | only if not Baseten's `https://inference.baseten.co/v1` |
| `KEEL_GLIMMER_BASE_URL`, `KEEL_GLIMMER_MODEL` | variables | optional: Muse Glimmer endpoint |
| `KEEL_GLIMMER_API_KEY` | secret | optional |
| `KEEL_*_PRICE_IN`, `KEEL_*_PRICE_OUT` | variables | $ per 1M input/output tokens, for the cost table |

Check locally with `keel doctor` (it never prints keys).

> To confirm with the providers: (a) the exact Muse Spark model id and base URL; (b) whether the
> Baseten endpoint for `meta-models/muse-spark-open-1026` returns token `logprobs` (Keel uses them if
> present, and still works without them).

## 3. Run the benchmarks (fills the dashboard with real numbers)
Actions → **Benchmark – QuixBugs** → *Run workflow*. It takes about 1 hour and costs roughly
40 bugs × 2 models × 5 samples = 400 generations plus 40 adversarial test files.
It commits `results/quixbugs/records.jsonl`, `results/quixbugs/calibration.json` and
`site/data/results.json`. The dashboard switches from *preview* to real data automatically.

Then Actions → **Benchmark – SWE-bench Lite** → *Run workflow* (default 100 instances).
Generation uses the model APIs; the official harness then runs in up to 10 parallel jobs on free runners.

## 4. Live demo repository
1. Create a **public** repo `feedofmri/keel-demo`.
2. Copy everything from [`examples/keel-demo/`](examples/keel-demo/) into it.
3. Add the same secrets as in step 2.
4. Settings → Actions → General → Workflow permissions: **Read and write** and
   **Allow GitHub Actions to create and approve pull requests**.
5. Copy `results/quixbugs/calibration.json` from this repo to `.keel/calibration.json` in the demo repo.
6. Apply `bugs/01-discount-backwards.patch`, push, and watch a Keel PR appear.

## 5. Publish the Action
Create a release tag `v1` on this repository (Releases → Draft a new release → tag `v1`), so
`uses: feedofmri/keel@v1` works. Optional: tick *Publish this Action to the GitHub Marketplace*.

## 6. Submission (by Wed Nov 4, 9:00 PM ET)
- Repo public ✅ (already)
- Demo video (3 min): see [`docs/demo-video.md`](docs/demo-video.md)
- Submission text: see [`docs/submission.md`](docs/submission.md)
- Every team member listed on the submission page
- X post for the *Most Viral* prize: draft in `docs/submission.md`
