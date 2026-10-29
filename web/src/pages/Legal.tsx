import { Link } from "react-router-dom";
import { PageIntro, Section } from "../components/Page";
import { useTitle } from "../hooks/useTitle";
import { REPO_URL } from "../lib/env";

const UPDATED = "Last updated Oct 29, 2026";

export function Privacy() {
  useTitle("Keel Privacy");
  return (
    <>
      <PageIntro title="Privacy" lead="This policy describes the data collected by the Keel service at keel.boraqs.com, the purposes for which it is used, and how it can be removed." />
      <Section><div className="prose legal">
        <p className="updated">{UPDATED}</p>
        <h2>Data collected</h2>
        <ul>
          <li><strong>Your GitHub profile</strong>: login, avatar URL and user id, when you sign in with GitHub.</li>
          <li><strong>A session</strong>: your GitHub user token, encrypted, so that Keel can act on your behalf while you are signed in.</li>
          <li><strong>Repository settings and run summaries</strong>: risk level, models, decisions, scores, costs and failing test names.</li>
          <li><strong>Activity</strong>: which user changed a setting or gave feedback on a run.</li>
        </ul>
        <h2>Data not collected</h2>
        <ul>
          <li>Your source code, diffs or model output. Those stay on your GitHub Actions runner.</li>
          <li>Your model keys. They're stored as GitHub repository secrets, which Keel can write but not read back.</li>
          <li>Analytics or advertising trackers. The only third-party request is for the site's fonts, from Google Fonts.</li>
        </ul>
        <h2>Cookies</h2>
        <p>One session cookie keeps you signed in, and two short-lived cookies protect the GitHub sign-in flow. Your theme choice is kept in your browser's local storage.</p>
        <h2>Sharing</h2>
        <p>Data is not sold or shared with third parties. GitHub processes sign-in and repository actions; your model provider processes the prompts your workflow sends under your keys.</p>
        <h2>Retention</h2>
        <p>Candidate details for each run are kept for 90 days, run summaries for one year and the activity log for 90 days. Older records are deleted automatically.</p>
        <h2>Removing your data</h2>
        <p>Disconnect a repository from its settings page, or delete your account from <Link to="/app/settings/danger">Settings → Danger zone</Link>. Uninstalling the GitHub App stops all access.</p>
        <h2>Contact</h2>
        <p>Questions: open an issue on <a href={REPO_URL}>GitHub</a>.</p>
      </div></Section>
    </>
  );
}

export function Terms() {
  useTitle("Keel Terms");
  return (
    <>
      <PageIntro title="Terms of use" lead="These terms govern the use of the Keel software and the hosted Keel service." />
      <Section><div className="prose legal">
        <p className="updated">{UPDATED}</p>
        <h2>The software</h2>
        <p>Keel's code is released under the MIT license. You can run it yourself, change it, and use it commercially under that license.</p>
        <h2>The hosted service</h2>
        <p>keel.boraqs.com is a hackathon project offered free of charge, without uptime or support commitments. It may change or stop.</p>
        <h2>Your responsibilities</h2>
        <ul>
          <li>Connect only repositories that you are authorised to manage.</li>
          <li>Use model providers under their own terms, with your own keys.</li>
          <li>Decide whether to enable auto-merge. Keel's guarantee is statistical: it bounds the rate of incorrect automatic merges, not any single change.</li>
        </ul>
        <h2>No warranty</h2>
        <p>The software and service are provided “as is”, without warranty of any kind, as stated in the MIT license. Review the <Link to="/guarantee">assumptions behind the guarantee</Link> before relying on it.</p>
      </div></Section>
    </>
  );
}
