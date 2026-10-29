import { Code, NextLinks, PageIntro, RefTable, Section } from "../components/Page";
import { GlimmerArt, OpenArt, SparkArt } from "../components/ModelArt";
import { useTitle } from "../hooks/useTitle";

const MODELS = [
  { art: <SparkArt />, tag: "Meta Model API", name: "Muse Spark",
    role: "Writes most of the candidate fixes, then writes the adversarial tests that attack every candidate.",
    signals: "Adversarial tests, self-consistency across its own samples, an optional plain-English explanation in the PR.",
    env: "KEEL_MUSE_SPARK_BASE_URL · _API_KEY · _MODEL" },
  { art: <OpenArt id="cw-models" />, tag: "Open weights · Baseten", name: "Muse Spark Open",
    role: "A second, independent generator. When two different models reach the same behaviour, that agreement is strong evidence.",
    signals: "Cross-model agreement, plus token log-probabilities and reasoning length, which only open weights expose.",
    env: "KEEL_SPARK_OPEN_API_KEY · _MODEL (base URL defaults to Baseten)" },
  { art: <GlimmerArt />, tag: "Open weights · optional", name: "Muse Glimmer",
    role: "Cheap triage. It estimates how hard a bug is and sets how many samples the bigger models spend on it.",
    signals: "Sample budget; a low-cost baseline in the evaluation.",
    env: "KEEL_GLIMMER_BASE_URL · _API_KEY · _MODEL" },
];

const SIGNALS: [string, string, string][] = [
  ["attack_survival", "Muse Spark (attacker)", "Share of adversarial tests the candidate passes."],
  ["cross_model_agreement", "Spark + Spark Open", "Whether the other model's candidates behave the same way."],
  ["consensus_score · behavior_agreement", "All samples", "How many candidates share this one's behaviour on the tests (CodeT / Agentless style)."],
  ["mean_logprob · min_logprob", "Spark Open (open weights)", "How sure the model was, token by token, while writing the fix."],
  ["log_reasoning_tokens", "Spark Open", "How long the model had to think. Long deliberation often means a harder, riskier fix."],
  ["log_diff_size · n_files · n_hunks", "The patch", "Small, focused patches are safer."],
  ["frac_files_in_traceback · log_line_distance", "The patch + traceback", "Whether the edit is where the failure actually happened."],
  ["static_delta", "Static analysis", "New warnings introduced by the patch."],
  ["self_confidence", "The generator", "The model's own estimate. Used as a feature and as a baseline, never on its own."],
];

export default function Models() {
  useTitle("Meta Models in Keel");
  return (
    <>
      <PageIntro eyebrow="Meta models" title="A panel of models that check each other"
        lead="Keel uses Meta's Muse models as generators, as attackers, and as a source of uncertainty signals. Each one has a distinct job." />

      <Section eyebrow="The panel" title="Three models, three jobs">
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

      <Section tone="tint" eyebrow="Into the score" title="What each signal measures"
        lead="The risk score is a logistic model over these features, after hard gates. Its weights are fitted on held-out bugs.">
        <RefTable head={["Feature", "Comes from", "Why it matters"]} rows={SIGNALS} />
      </Section>

      <Section eyebrow="Providers" title="One client, any OpenAI-compatible endpoint"
        lead="Every model goes through the same OpenAI-compatible client, so changing provider is a configuration change. Keys live in your repository's secrets, never on Keel's servers.">
        <div className="split">
          <div>
            <ul className="bullets">
              <li>The Keel app stores keys as encrypted GitHub repository secrets during setup.</li>
              <li>Responses can be cached by request, so reruns and benchmarks don't pay twice.</li>
              <li>Per-candidate cost is recorded and shown on the Usage page in the app.</li>
            </ul>
          </div>
          <Code lang="shell">{`keel doctor
# muse-spark       configured   https://…/v1
# muse-spark-open  configured   https://inference.baseten.co/v1
# muse-glimmer     not set`}</Code>
        </div>
      </Section>

      <NextLinks links={[
        { to: "/how-it-works", title: "How it works", text: "Where each model fits into a run." },
        { to: "/docs/configuration", title: "Configuration", text: "Choose models, samples and the attacker in .keel.toml." },
        { to: "/results", title: "Results", text: "Solve rate and cost per Meta model." },
      ]} />
    </>
  );
}
