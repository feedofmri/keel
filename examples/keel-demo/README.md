# keel-demo

A tiny shop library with a test suite, wired to **Keel**. Push a bug, watch CI fail, and Keel opens a pull
request labelled **AUTO-MERGE** or **NEEDS REVIEW**.

## Set up (once)
1. Create a public repo (e.g. `keel-demo`) and copy this folder's contents into it.
2. Settings → Secrets and variables → Actions: add the Keel model secrets (see Keel's `SETUP.md`).
3. Settings → Actions → General → Workflow permissions: **Read and write**, and tick
   **Allow GitHub Actions to create and approve pull requests**.
4. Put a calibration file at `.keel/calibration.json` (from Keel's QuixBugs benchmark run).
   Without one, Keel works but labels everything NEEDS REVIEW.

## Run the demo
```bash
git apply bugs/01-discount-backwards.patch   # clear bug, expect AUTO-MERGE
git commit -am "Refactor discount maths" && git push
```
CI fails → the Keel workflow starts → a PR appears with the decision and explanation.

```bash
git apply bugs/02-shipping-rules.patch       # two bugs, only one is covered by tests
git commit -am "Tweak shipping rules" && git push
```
Here a patch can pass every visible test and still be wrong. This is where Keel should say NEEDS REVIEW.

You can also comment `/keel fix` on any issue or PR (write access required).
