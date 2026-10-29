# Keel

**A code-repair agent that knows when it should not be trusted.**

Keel uses Meta's models to generate candidate patches for failing tests, scores each patch with a
code-aware nonconformity score, and uses conformal risk control to label every fix **AUTO-MERGE**
or **NEEDS REVIEW**, with a statistical guarantee on the rate of wrong auto-merges.

Built for the Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026), *Push the Frontier* track.
See [`HACKATHON.md`](HACKATHON.md) for exactly what was built during the event.

> 🚧 Under active development during the hackathon.
