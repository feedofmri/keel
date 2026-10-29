import { NextLinks, PageIntro, Points, RefTable, Section } from "../components/Page";
import { useTitle } from "../hooks/useTitle";
import { REPO_URL } from "../lib/env";

export default function Security() {
  useTitle("Keel Security");
  return (
    <>
      <PageIntro title="Security"
        lead="Repairs run on your own GitHub Actions runners. The Keel service stores settings and run summaries; it does not store source code or model keys." />

      <Section title="Where processing takes place">
        <Points cols={3} items={[
          { title: "Your runners", text: "Checkout, model requests, adversarial testing and pull request creation take place within your repository's GitHub Actions job." },
          { title: "The Keel service", text: "Sign-in, repository settings, the setup pull request and a summary of each run: scores, decision, cost and test names." },
          { title: "Your model provider", text: "Requests containing the failing test and relevant code are sent to the Meta model endpoints you configure, using your own keys." },
        ]} />
      </Section>

      <Section tone="tint" title="GitHub App permissions">
        <RefTable mono={false} head={["Permission", "Access", "Used for"]} rows={[
          ["Contents", "Read and write", "Read the file list during setup; the setup pull request adds the workflow and .keel.toml."],
          ["Pull requests", "Read and write", "Open the setup pull request and detect when Keel's pull requests are merged or reverted."],
          ["Workflows", "Read and write", "Add .github/workflows/keel.yml, and pause or resume it."],
          ["Actions", "Read and write", "Start a run when Fix now is selected."],
          ["Secrets", "Read and write", "Store model keys as encrypted repository secrets."],
          ["Issues", "Read and write", "Apply labels to Keel's pull requests."],
          ["Metadata", "Read", "Required by GitHub for all apps."],
        ]} />
        <p className="p-small" style={{ marginTop: 20 }}>You choose which repositories the app can see when you install it, and can change that any time in GitHub's settings.</p>
      </Section>

      <Section title="What Keel stores">
        <RefTable mono={false} head={["Data", "Stored", "Notes"]} rows={[
          ["GitHub profile", "Login, avatar URL, user id", "From GitHub sign-in."],
          ["Session", "Your GitHub user token, encrypted (AES-256-GCM)", "Expires after 14 days; refreshed tokens are re-encrypted. Signing out deletes it, and expired sessions are removed daily."],
          ["Repository settings", "Risk level, method, models, CI workflow name", "The values written to .keel.toml by the setup pull request."],
          ["Run summaries", "Decision, scores, threshold, cost, failing test names, candidate summaries", "Diffs, source code and model output do not leave the runner. Candidate summaries are kept for 90 days and run summaries for one year."],
          ["Model keys", "Not stored", "Sent over HTTPS once during setup, sealed with the repository's public key (libsodium) and saved as GitHub repository secrets. Never written to Keel's database or logs."],
          ["Activity", "Changes made by each user, with timestamps", "Setup pull requests, pause and resume, Fix now, and feedback on runs. Kept for 90 days."],
        ]} />
      </Section>

      <Section tone="tint" title="Safeguards">
        <Points cols={3} items={[
          { title: "Verified run reports", text: "Runs report results with a GitHub Actions OIDC token, which is verified for issuer, audience and repository. No shared secret is required." },
          { title: "Signed webhooks", text: "GitHub webhooks are rejected unless their HMAC signature is valid." },
          { title: "CSRF protection", text: "State-changing requests require a custom header and must originate from Keel's own domain." },
          { title: "Least privilege", text: "Every repository request verifies your permission on GitHub. Changing settings requires admin or maintain access." },
          { title: "Isolated candidates", text: "Model-generated code runs without access to repository secrets and may not modify tests or CI." },
          { title: "Data deletion", text: "Repositories can be disconnected and accounts deleted from the settings pages; the associated data is removed." },
        ]} />
      </Section>

      <Section title="Reporting a vulnerability">
        <p className="p-large" style={{ maxWidth: 640 }}>Please report vulnerabilities privately through <a href={`${REPO_URL}/security/advisories/new`}>GitHub security advisories</a> rather than a public issue.</p>
      </Section>

      <NextLinks links={[
        { to: "/privacy", title: "Privacy", text: "How personal data is handled." },
        { to: "/how-it-works", title: "How it works", text: "The safeguards applied in each run." },
        { to: "/docs/github-action", title: "GitHub Action", text: "The workflow in detail." },
      ]} />
    </>
  );
}
