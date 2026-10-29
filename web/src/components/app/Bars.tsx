/** A small bar chart for daily values, with a hover title per bar. */
export function Bars({ data, value, label }: { data: { day: string }[]; value: (d: any) => number; label: (d: any) => string }) {
  const max = Math.max(1e-9, ...data.map(value));
  return (
    <>
      <div className="bars" role="img" aria-label="Daily chart">
        {data.map(d => { const v = value(d); return <div key={d.day} className={`bar${v ? "" : " zero"}`} style={{ height: `${(v / max) * 100}%` }} title={`${d.day}: ${label(d)}`} />; })}
      </div>
      <div className="bars-axis"><span>{data[0]?.day.slice(5)}</span><span>{data[data.length - 1]?.day.slice(5)}</span></div>
    </>
  );
}
