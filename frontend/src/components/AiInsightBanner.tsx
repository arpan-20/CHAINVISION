import { useEffect, useState } from 'react'

/* ──────────────────────────────────────────────
   AI INSIGHT BANNER — rotating AI-generated insights
   ────────────────────────────────────────────── */
export interface Insight {
  id: string
  severity: 'info' | 'warning' | 'critical' | 'success'
  title: string
  detail: string
  cta?: { label: string; href: string }
}

const SAMPLE_INSIGHTS: Insight[] = [
  {
    id: '1',
    severity: 'warning',
    title: '3 SKUs will expire before next PO arrives',
    detail: 'FEFO analysis on DC-04 (Bengaluru). Estimated write-off ₹2.4L if no action by Friday.',
    cta: { label: 'Review batches', href: '/planner/expiry-risk' },
  },
  {
    id: '2',
    severity: 'info',
    title: 'Demand spike detected — Paracetamol 500mg',
    detail: 'Zone B-3 flu-season signal 2.4× normal. Forecast suggests reorder 8% above safety stock.',
    cta: { label: 'View signals', href: '/planner/demand-signals' },
  },
  {
    id: '3',
    severity: 'success',
    title: 'Touchless rate improved 4% this week',
    detail: 'Auto-approval up to 91%. 23 fewer manual touches vs. last week across P2P flow.',
  },
  {
    id: '4',
    severity: 'critical',
    title: 'Supplier X — 3 POs unacknowledged > 48h',
    detail: 'Auto-escalation drafted. Recommend switching to backup supplier for next 2 orders.',
  },
]

interface AiInsightBannerProps {
  insights?: Insight[]
  className?: string
}

export default function AiInsightBanner({ insights = SAMPLE_INSIGHTS, className = '' }: AiInsightBannerProps) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const insight = insights[index]

  useEffect(() => {
    if (insights.length <= 1) return
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % insights.length)
        setVisible(true)
      }, 400)
    }, 7000)
    return () => clearInterval(t)
  }, [insights.length])

  if (!insight) return null

  const toneStyles: Record<Insight['severity'], { dot: string; ring: string; text: string; gradient: string; icon: JSX.Element }> = {
    info: {
      dot: 'bg-signal shadow-[0_0_8px_rgba(47,227,196,0.7)]',
      ring: 'border-signal/30',
      text: 'text-signal',
      gradient: 'from-signal/10 to-signal/0',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
    },
    warning: {
      dot: 'bg-alert shadow-[0_0_8px_rgba(242,169,59,0.7)]',
      ring: 'border-alert/30',
      text: 'text-alert',
      gradient: 'from-alert/10 to-alert/0',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    critical: {
      dot: 'bg-critical shadow-[0_0_8px_rgba(240,85,92,0.7)]',
      ring: 'border-critical/30',
      text: 'text-critical',
      gradient: 'from-critical/10 to-critical/0',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
    success: {
      dot: 'bg-signal shadow-[0_0_8px_rgba(47,227,196,0.7)]',
      ring: 'border-signal/30',
      text: 'text-signal',
      gradient: 'from-signal/10 to-signal/0',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
  }

  const tone = toneStyles[insight.severity]

  return (
    <div
      className={`relative overflow-hidden rounded-lg border ${tone.ring} bg-gradient-to-r ${tone.gradient} backdrop-blur-md transition-all duration-500 ${className}`}
    >
      {/* Animated gradient sweep */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s linear infinite',
        }}
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-3 p-3 sm:p-4">
        {/* AI badge */}
        <div className="flex shrink-0 items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-md border ${tone.ring} bg-ink/40 ${tone.text}`}>
            {tone.icon}
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-mist/70">AI Insight</span>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot} animate-pulse-dot`} />
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-mist/50">
              {String(index + 1).padStart(2, '0')} / {String(insights.length).padStart(2, '0')}
            </span>
          </div>
          <p
            className={`mt-1 text-sm font-medium text-paper transition-all duration-500 ${
              visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
            }`}
          >
            {insight.title}
          </p>
          <p
            className={`mt-0.5 text-xs text-mist transition-all duration-500 ${
              visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
            }`}
          >
            {insight.detail}
          </p>
        </div>

        {/* CTA + pager */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {insight.cta && (
            <a
              href={insight.cta.href}
              className={`group/cta inline-flex items-center gap-1 rounded-md border ${tone.ring} bg-ink/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${tone.text} transition-all hover:bg-ink/70`}
            >
              {insight.cta.label}
              <svg className="h-3 w-3 transition-transform group-hover/cta:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          )}
          {/* Progress dots */}
          {insights.length > 1 && (
            <div className="flex gap-1">
              {insights.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 w-3 rounded-full transition-all ${i === index ? `${tone.dot}` : 'bg-white/10'}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
