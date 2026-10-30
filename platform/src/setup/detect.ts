// Detect how a repository is built and tested, from its file list and a few file contents.

export interface Detection {
  language: "python" | "unknown";
  testCommand: string;
  installCommand: string;
  ciWorkflow: string | null;
  workflows: string[];
  notes: string[];
}

export const KEEL_TEST_COMMAND = "{python} -m pytest -q -p no:cacheprovider {tests} --junitxml={junit}";

export function workflowName(yaml: string, fallback: string): string {
  const m = yaml.match(/^name:\s*["']?([^"'\n#]+?)["']?\s*(#.*)?$/m);
  return m ? m[1].trim() : fallback;
}

export function detect(paths: string[], files: Record<string, string>): Detection {
  const notes: string[] = [];
  const has = (p: string) => paths.includes(p);
  const py = has("pyproject.toml") || has("setup.py") || has("setup.cfg") || paths.some(p => /(^|\/)requirements[^/]*\.txt$/.test(p))
    || paths.some(p => p.endsWith(".py"));
  const language = py ? "python" : "unknown";
  if (!py) notes.push("Keel v1 supports Python repositories; this one doesn't look like Python.");

  // A pyproject.toml is only installable when it declares a package or a build system; many hold
  // nothing but tool settings ([tool.pytest] and the like), and `pip install -e .` fails on those.
  const pyproject = files["pyproject.toml"] ?? "";
  const installable = has("setup.py") || has("setup.cfg") || /^\[(project|build-system)\]/m.test(pyproject);
  let installCommand = "pip install pytest";
  if (installable) installCommand = "pip install -e . pytest";
  else if (has("requirements.txt")) installCommand = "pip install -r requirements.txt pytest";
  if (has("requirements-dev.txt")) installCommand += " -r requirements-dev.txt";

  const hasTests = paths.some(p => /(^|\/)(tests?\/|test_[^/]+\.py$|[^/]+_test\.py$)/.test(p));
  if (!hasTests) notes.push("No pytest-style tests found. Keel repairs failing tests, so it needs a test suite.");

  const wfPaths = paths.filter(p => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p) && !/keel\.ya?ml$/.test(p));
  const workflows = wfPaths.map(p => workflowName(files[p] || "", p.split("/").pop()!.replace(/\.ya?ml$/, "")));
  const scored = wfPaths.map((p, i) => {
    const y = (files[p] || "").toLowerCase();
    return { name: workflows[i], score: (y.includes("pytest") ? 3 : 0) + (/\btest/.test(y) ? 1 : 0) + (/^name:\s*ci\b/m.test(y) ? 2 : 0) };
  }).sort((a, b) => b.score - a.score);
  const ciWorkflow = scored.length ? scored[0].name : null;
  if (!ciWorkflow) notes.push("No CI workflow found. Keel can still be run on demand or with /keel fix.");

  return { language, testCommand: KEEL_TEST_COMMAND, installCommand, ciWorkflow, workflows, notes };
}
