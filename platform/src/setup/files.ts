// The two files Keel adds to a repository in its setup pull request.

export interface RepoSettings {
  alpha: number;
  method: "crc" | "ltt";
  autoMerge: boolean;
  models: string[];
  ciWorkflow: string | null;
  installCommand: string;
  testCommand: string;
}

const MODEL_ENV: Record<string, string[]> = {
  "muse-spark": ["KEEL_MUSE_SPARK_BASE_URL", "KEEL_MUSE_SPARK_API_KEY", "KEEL_MUSE_SPARK_MODEL"],
  "muse-spark-open": ["KEEL_SPARK_OPEN_BASE_URL", "KEEL_SPARK_OPEN_API_KEY", "KEEL_SPARK_OPEN_MODEL"],
  "muse-glimmer": ["KEEL_GLIMMER_BASE_URL", "KEEL_GLIMMER_API_KEY", "KEEL_GLIMMER_MODEL"],
};

export const secretNamesFor = (models: string[]) => [...new Set(models.flatMap(m => MODEL_ENV[m] || []))];

const yamlStr = (s: string) => JSON.stringify(s);

export function renderWorkflow(s: RepoSettings, actionRef: string, platformUrl: string): string {
  const triggers = [
    s.ciWorkflow ? `  workflow_run:\n    workflows: [${yamlStr(s.ciWorkflow)}]\n    types: [completed]` : null,
    "  issue_comment:\n    types: [created]",
    "  workflow_dispatch:",
  ].filter(Boolean).join("\n");
  const env = secretNamesFor(s.models).map(n => `          ${n}: \${{ secrets.${n} }}`).join("\n");
  return `# Added by Keel (${platformUrl}). Keel repairs failing tests and labels each fix
# AUTO-MERGE or NEEDS REVIEW using conformal risk control. Settings live in .keel.toml.
name: Keel
on:
${triggers}

permissions:
  contents: write
  pull-requests: write
  issues: write
  id-token: write   # lets Keel report run results to ${platformUrl} without a stored secret

jobs:
  keel:
    if: >-
      (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'failure') ||
      (github.event_name == 'issue_comment' && startsWith(github.event.comment.body, '/keel fix')) ||
      github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.workflow_run.head_sha || github.ref }}
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: ${s.installCommand}
      - uses: ${actionRef}
        env:
${env}
          KEEL_PLATFORM_URL: ${platformUrl}
`;
}

export function renderKeelToml(s: RepoSettings): string {
  return `# Keel configuration (managed from ${"the Keel dashboard"}; edits here are fine too).
[keel]
alpha = ${s.alpha.toFixed(2)}          # accept at most this risk of wrong auto-merges
method = "${s.method}"          # "crc" per bug, "ltt" per merge
models = [${s.models.map(m => `"${m}"`).join(", ")}]
attacker = "${s.models.includes("muse-spark") ? "muse-spark" : s.models[0]}"
test_command = ${JSON.stringify(s.testCommand)}
enable_auto_merge = ${s.autoMerge}
`;
}
