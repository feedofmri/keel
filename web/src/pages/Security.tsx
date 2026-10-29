import { NextLinks, PageIntro, Points, RefTable, Section } from "../components/Page";
import { useTitle } from "../hooks/useTitle";
import { REPO_URL } from "../lib/env";

export default function Security() {
  useTitle("Keel Security");
  return (
    <>
      <PageIntro eyebrow="Security" title="Your code stays on GitHub"
        lead="Repairs run on your own GitHub Actions runners. The Keel app stores settings and run summaries, never your source code or model keys." />

      <Section eyebrow="Where things run" title="What happens where">
        <Points cols={3} items={[
          { title: "On your runners", text: "Checkout, model calls, adversarial tests and the pull request all happen inside your repository's GitHub Actions job." },
          { title: "In the Keel app", text: "Sign-in, repository settings, the setup pull request, and a summary of each run: scores, decision, cost, test names." },
          { title: "At your model provider", text: "Prompts with the failing test and relevant code go to the Meta model endpoints you configure, under your own keys." },
        ]} />
      </Section>

      <Section tone="tint" eyebrow="GitHub App" title="Permissions, and why each is needed">
        <RefTable mono={false} head={["Permission", "Access", "Used for"]} rows={[
          ["Contents", "Read and write", "Read the file list during setup; the setup PR adds the workflow and .keel.toml."],
          ["Pull requests", "Read and write", "Open the setup PR; notice when Keel's PRs merge or are reverted."],
          ["Workflows", "Read and write", "Add .github/workflows/keel.yml; pause and resume it."],
          ["Actions", "Read and write", "Start a run when you press Fix now."],
          ["Secrets", "Read and write", "Store your model keys as encrypted repository secrets."],
          ["Issues", "Read and write", "Labels on Keel's pull requests."],
          ["Metadata", "Read", "Required by GitHub for every app."],
        ]} />
        <p className="p-small" style={{ marginTop: 20 }}>You choose which repositories the app can see when you install it, and can change that any time in GitHub's settings.</p>
      </Section>

      <Section eyebrow="Data" title="What Keel stores">
        <RefTable mono={false} head={["Data", "Stored", "Notes"]} rows={[
          ["GitHub profile", "Login, avatar URL, user id", "From GitHub sign-in."],
          ["Session", "Your GitHub user token, encrypted (AES-256-GCM)", "Expires after 30 days; refreshed tokens are re-encrypted. Sign out removes it."],
          ["Repository settings", "Risk level, method, models, CI workflow name", "What the setup PR writes into .keel.toml."],
          ["Run summaries", "Decision, scores, threshold, cost, failing test names, candidate summaries", "No diffs, source code or model output leave the runner."],
          ["Model keys", "Not stored", "Sent over HTTPS once during setup, sealed with the repository's public key (libsodium) and saved as GitHub repository secrets. Never written to Keel's database or logs."],
          ["Activity", "Who changed what, and when", "Setup PRs, pause/resume, Fix now, feedback on runs."],
        ]} />
      </Section>

      <Section tone="tint" eyebrow="Safeguards" title="How the service is protected">
        <Points cols={3} items={[
          { title: "Verified run reports", text: "Runs report back with a GitHub Actions OIDC token, checked for issuer, audience and repository. No shared secret is involved." },
          { title: "Signed webhooks", text: "GitHub webhooks are rejected unless their HMAC signature matches." },
          { title: "CSRF protection", text: "State-changing requests need a custom header and must come from Keel's own origin." },
          { title: "Least access", text: "Every repository request re-checks your permission on GitHub. Changing settings needs admin or maintain access." },
          { title: "Sandboxed candidates", text: "Model-written code runs with secrets scrubbed from its environment, and can't touch tests or CI." },
          { title: "Delete anytime", text: "Disconnect a repository or delete your account from the app's settings; the data goes with it." },
        ]} />
      </Section>

      <Section eyebrow="Reporting" title="Found a vulnerability?">
        <p className="p-large" style={{ maxWidth: 640 }}>Please report it privately through <a href={`${REPO_URL}/security/advisories/new`}>GitHub security advisories</a> rather than a public issue.</p>
      </Section>

      <NextLinks links={[
        { to: "/privacy", title: "Privacy", text: "How personal data is handled." },
        { to: "/how-it-works", title: "How it works", text: "The safety rails inside each run." },
        { to: "/docs/github-action", title: "GitHub Action", text: "Exactly what the workflow does." },
      ]} />
    </>
  );
}
