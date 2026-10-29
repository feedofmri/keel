// The public site map, shared by the header, the mobile menu and the footer.
export const PRIMARY = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/guarantee", label: "Guarantee" },
  { to: "/models", label: "Models" },
  { to: "/results", label: "Results" },
  { to: "/docs", label: "Docs" },
];
export const FOOTER: { title: string; links: { to: string; label: string; external?: boolean }[] }[] = [
  { title: "Product", links: [{ to: "/how-it-works", label: "How it works" }, { to: "/guarantee", label: "The guarantee" },
    { to: "/models", label: "Meta models" }, { to: "/compare", label: "Compare" }, { to: "/results", label: "Results" }] },
  { title: "Developers", links: [{ to: "/docs", label: "Quickstart" }, { to: "/docs/configuration", label: "Configuration" },
    { to: "/docs/github-action", label: "GitHub Action" }, { to: "/docs/cli", label: "CLI" }, { to: "/docs/faq", label: "FAQ" }] },
  { title: "Project", links: [{ to: "/about", label: "About" }, { to: "/security", label: "Security" }, { to: "/privacy", label: "Privacy" },
    { to: "/terms", label: "Terms" }, { to: "https://github.com/feedofmri/keel", label: "GitHub", external: true }] },
];
