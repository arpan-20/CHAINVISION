// Minimal, hand-drawn line icons themed around distribution/logistics.
// Kept dependency-free (no icon package) so the P1 frontend scaffold
// doesn't grow its bundle for five glyphs.

type IconProps = {
  className?: string
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function OverviewIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.4" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.4" />
      <rect x="13" y="10.5" width="7.5" height="10" rx="1.4" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.4" />
    </svg>
  )
}

export function CrateIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 8.2 12 4l8.5 4.2v7.6L12 20l-8.5-4.2Z" />
      <path d="M3.5 8.2 12 12l8.5-4.2" />
      <path d="M12 12v8" />
      <path d="M7.75 6.1 16.25 10.3" />
    </svg>
  )
}

export function HourglassIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3.5h12" />
      <path d="M6 20.5h12" />
      <path d="M7 3.5v3.1c0 1.6.9 3.1 2.4 3.9l2.6 1.5 2.6-1.5c1.5-.8 2.4-2.3 2.4-3.9V3.5" />
      <path d="M7 20.5v-3.1c0-1.6.9-3.1 2.4-3.9l2.6-1.5 2.6 1.5c1.5.8 2.4 2.3 2.4 3.9v3.1" />
    </svg>
  )
}

export function RouteIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="6" r="2" />
      <path d="M5 16c0-6 3-9 6-9h1" />
      <path d="M15.5 7.8 12.2 6.5l.6-3.5" />
    </svg>
  )
}

export function PulseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 12h3.5l2-6 4 12 2-9 1.5 3H21" />
    </svg>
  )
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

/** Brand mark: three linked distribution nodes with a live signal pulse. */
export function NetworkMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className}>
      <path
        d="M8 22 16 10l8 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <circle cx="16" cy="10" r="3" fill="currentColor" />
      <circle cx="8" cy="22" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="24" cy="22" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
