import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from 0 to the target value over `duration` ms.
 * Uses requestAnimationFrame for smooth, jitter-free tween.
 */
export function useCountUp(target: number, duration = 1200, delay = 0): number {
  const [value, setValue] = useState(0)
  const prevTarget = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const start = performance.now() + delay
    const from = prevTarget.current
    const to = target
    const delta = to - from

    const tick = (now: number) => {
      if (now < start) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const t = Math.min(1, (now - start) / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + delta * eased
      setValue(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        prevTarget.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, delay])

  return value
}

/**
 * Returns true once after `delay` ms — useful for entry animations.
 */
export function useMounted(delay = 0): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return mounted
}

/**
 * Returns current scroll Y position. Used for parallax / scroll-driven effects.
 */
export function useScrollY(): number {
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return scrollY
}
