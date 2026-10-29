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
- Completed the platform before deployment: the shared calibration is delivered by the setup pull
  request (never a simulated one), closed setup pull requests reset the repository, GitHub errors
  return clear messages, rate limits and a Content Security Policy are in place.
- Added an end-to-end suite against a fake GitHub (sign-in, sync, detection, encrypted secrets, setup
  pull request, webhooks, run reports, runs pages, feedback, Fix now, pause/resume, errors, limits)
  and a browser test of the live web build against the real API. They found and fixed a bug that
  rejected every real run report (timestamps with a "+00:00" offset).
- Tools: Claude Code. Muse Code: not used yet today.
