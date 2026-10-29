import { MARK } from "../visuals/halftoneLogo";

export function KeelMark({ className }: { className?: string }) {
  return <svg className={className} viewBox="590 568 752 792" fill="currentColor" aria-hidden="true">{MARK.map(d => <path key={d} d={d} />)}</svg>;
}
