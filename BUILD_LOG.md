# Build log

A dated record of the work done during the hackathon (times in UTC). Tools used are noted each day.

## Thu Oct 29, 2026
- Created this repository (fresh history; nothing from before the event).
- Built the core pipeline, Meta model clients, adversarial tests, scorer and conformal layer.
- Built the GitHub Action, evaluation harness (QuixBugs labels verified for all 40 programs),
  benchmark workflows, website and dashboard, demo repo template, video motion graphics.
- Researched the competitive landscape (`docs/competitive-landscape.md`).
- Redesigned the website: light primary theme with dark bands; interactive "waterline" hero.
- Built the Keel platform: GitHub sign-in, repositories, setup wizard, run reports (`platform/`).
- Rebuilt the frontend in React (`web/`): one shared header per zone (public / app), layouts, a
  route guard for `/app`, and shared components, replacing the hand-written HTML pages.
- Planned and built the full page set: separate public pages with their own content, docs, and the
  platform pages (overview, runs, run detail, calibration, usage, activity, settings, help) with
  their API. The Action now reports a per-candidate summary for the run page.
- Tools: Claude Code. Muse Code: not used yet today.
