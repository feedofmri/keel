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

| Component | Status | Commits |
|-----------|--------|---------|
| _filled in as we build_ | | |

## What we did not build (third-party)
Used only as declared dependencies or downloaded at run time, under their own licenses:
- Python libraries listed in `pyproject.toml` (numpy, httpx, PyJWT, fastapi, uvicorn, pyflakes, pytest).
- Benchmarks, downloaded at run time and not redistributed: SWE-bench / SWE-bench Lite
  (MIT, Princeton NLP) and QuixBugs (MIT, Lin et al.).
- Meta models used through their APIs: Muse Spark (Meta Model API), Muse Spark Open and
  Muse Glimmer (open weights, served by inference partners).

## Tools used to build Keel
- **Muse Code** (Meta's coding agent): every use is logged in [`BUILD_LOG.md`](BUILD_LOG.md).
- **Claude Code**, an AI coding assistant. Commits it helped write carry a `Co-Authored-By` trailer.
