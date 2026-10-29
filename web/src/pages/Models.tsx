import { Code, NextLinks, PageIntro, RefTable, Section } from "../components/Page";
import { GlimmerArt, OpenArt, SparkArt } from "../components/ModelArt";
import { useTitle } from "../hooks/useTitle";

const MODELS = [
  { art: <SparkArt />, tag: "Meta Model API", name: "Muse Spark",
    role: "Generates candidate patches and writes the adversarial tests used to evaluate every candidate.",
    signals: "Adversarial test results, consistency across its own samples, and an optional plain-language summary in the pull request.",
    env: "KEEL_MUSE_SPARK_BASE_URL · _API_KEY · _MODEL" },
  { art: <OpenArt id="cw-models" />, tag: "Open weights · Baseten", name: "Muse Spark Open",
    role: "An independent second generator. Agreement between two different models is a strong indicator of a correct patch.",
    signals: "Cross-model agreement, token log-probabilities and reasoning length, which are available only from open-weight models.",
    env: "KEEL_SPARK_OPEN_API_KEY · _MODEL (base URL defaults to Baseten)" },
  { art: <GlimmerArt />, tag: "Open weights · optional", name: "Muse Glimmer",
    role: "Low-cost triage. It estimates the difficulty of each bug and sets the number of samples requested from the larger models.",
    signals: "Sample budget, and a low-cost baseline in the evaluation.",
    env: "KEEL_GLIMMER_BASE_URL · _API_KEY · _MODEL" },
];

const SIGNALS: [string, string, string][] = [
  ["attack_survival", "Muse Spark (attacker)", "Share of adversarial tests the candidate passes."],
  ["cross_model_agreement", "Spark + Spark Open", "Whether the other model's candidates exhibit the same behaviour."],
  ["consensus_score · behavior_agreement", "All samples", "The number of candidates that share this candidate's test behaviour (as in CodeT and Agentless)."],
  ["mean_logprob · min_logprob", "Spark Open (open weights)", "The model's token-level confidence while generating the patch."],
  ["log_reasoning_tokens", "Spark Open", "The length of the model's reasoning. Longer reasoning is associated with harder, higher-risk patches."],
  ["log_diff_size · n_files · n_hunks", "The patch", "Small, focused patches carry less risk."],
  ["frac_files_in_traceback · log_line_distance", "The patch + traceback", "Whether the change is located where the failure occurred."],
  ["static_delta", "Static analysis", "New warnings introduced by the patch."],
  ["self_confidence", "The generator", "The model's own estimate. Used as one feature and as a baseline, never as the sole criterion."],
];

export default function Models() {
  useTitle("Meta Models in Keel");
  return (
    <>
      <PageIntro title="Meta models in Keel"
        lead="Keel uses Meta's Muse models to generate patches, to test them adversarially and to provide uncertainty signals. Each model has a defined role." />

      <Section title="Model roles">
        <div className="cards c3">
          {MODELS.map(m => (
            <div className="card-x" key={m.name}>
              <div className="ill" style={{ height: 96, marginBottom: 16 }}>{m.art}</div>
              <span className="tag">{m.tag}</span>
              <h3>{m.name}</h3>
              <p className="p-small">{m.role}</p>
              <dl><dt>Signals it adds</dt><dd>{m.signals}</dd><dt>Secrets</dt><dd className="mono" style={{ fontSize: 12.5 }}>{m.env}</dd></dl>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="tint" title="Signals in the risk score"
        lead="After the mandatory checks, the risk score is computed by a logistic model over these features. Its weights are fitted on held-out bugs.">
        <RefTable head={["Feature", "Comes from", "Why it matters"]} rows={SIGNALS} />
      </Section>

      <Section title="Model providers"
        lead="All models are accessed through a single OpenAI-compatible client, so a provider can be changed through configuration. API keys are stored in repository secrets and are never held on Keel's servers.">
        <div className="split">
          <div>
            <ul className="bullets">
              <li>During setup, the Keel application stores keys as encrypted GitHub repository secrets.</li>
              <li>Responses can be cached per request, so repeated runs and benchmarks do not incur duplicate costs.</li>
              <li>The cost of each candidate is recorded and reported on the Usage page.</li>
            </ul>
          </div>
          <Code lang="shell">{`keel doctor
# muse-spark       configured   https://…/v1
# muse-spark-open  configured   https://inference.baseten.co/v1
# muse-glimmer     not set`}</Code>
        </div>
      </Section>

      <NextLinks links={[
        { to: "/how-it-works", title: "How it works", text: "The role of each model in a run." },
        { to: "/docs/configuration", title: "Configuration", text: "Configure models, sample counts and the attacker in .keel.toml." },
        { to: "/results", title: "Results", text: "Solve rate and cost per Meta model." },
      ]} />
    </>
  );
}
