export function Segmented<T extends string>({ value, options, onChange, label }:
  { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, t]) => <button key={v} aria-pressed={v === value} onClick={() => onChange(v)}>{t}</button>)}
    </div>
  );
}
