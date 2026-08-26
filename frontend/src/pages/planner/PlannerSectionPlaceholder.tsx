import type { ComponentType } from 'react'

interface PlannerSectionPlaceholderProps {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  comingIn: string[]
}

export default function PlannerSectionPlaceholder({
  icon: Icon,
  title,
  description,
  comingIn,
}: PlannerSectionPlaceholderProps) {
  return (
    <div className="animate-rise-in mx-auto flex max-w-2xl flex-col items-start gap-5 rounded-2xl border border-line bg-panel px-8 py-10">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-panel2 text-signal">
        <Icon className="h-6 w-6" />
      </div>

      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist">Module preview</p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-paper">{title}</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-mist">{description}</p>
      </div>

      <div className="w-full rounded-xl border border-line bg-ink/60 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist">Module details</p>
        <ul className="mt-2 space-y-1.5">
          {comingIn.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-paper/80">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
