import { FormEvent, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import * as THREE from 'three'

import { supabaseClient } from '../lib/supabaseClient'
import { useAuth, type AuthRole } from '../hooks/useAuth'
import { NetworkMark } from '../components/icons'

interface LocationState {
  from?: {
    pathname?: string
  }
}

const homeForRole = (role: AuthRole | null) => {
  if (role === 'PROCUREMENT_OFFICER') return '/procurement'
  return '/planner'
}

/* ──────────────────────────────────────────────
   THREE.JS BACKGROUND — cinematic supply network
   ────────────────────────────────────────────── */
const bgNodeMaterial = new THREE.MeshStandardMaterial({
  color: 0x2fe3c4,
  emissive: 0x0c514a,
  metalness: 0.45,
  roughness: 0.3,
})
const bgHubMaterial = new THREE.MeshStandardMaterial({
  color: 0xeef1f7,
  emissive: 0x22314d,
  metalness: 0.6,
  roughness: 0.22,
})
const bgWarnMaterial = new THREE.MeshStandardMaterial({
  color: 0xf2a93b,
  emissive: 0x4a3108,
  metalness: 0.4,
  roughness: 0.34,
})
const bgCriticalMaterial = new THREE.MeshStandardMaterial({
  color: 0xf0555c,
  emissive: 0x451014,
  metalness: 0.35,
  roughness: 0.4,
})
const bgLineMaterial = new THREE.LineBasicMaterial({
  color: 0x2fe3c4,
  transparent: true,
  opacity: 0.22,
})
const bgPacketMaterial = new THREE.MeshStandardMaterial({
  color: 0x2fe3c4,
  emissive: 0x0c514a,
  metalness: 0.5,
  roughness: 0.25,
})
const bgParticleMaterial = new THREE.PointsMaterial({
  color: 0x8593af,
  size: 0.022,
  transparent: true,
  opacity: 0.55,
  sizeAttenuation: true,
  blending: THREE.AdditiveBlending,
})

const bgNodeGeometry = new THREE.IcosahedronGeometry(0.32, 2)
const bgHubGeometry = new THREE.BoxGeometry(0.85, 0.85, 0.85)
const bgPacketGeometry = new THREE.OctahedronGeometry(0.16, 1)

const bgPositionsFront = [
  new THREE.Vector3(-4.4, -1.5, 1.5),
  new THREE.Vector3(-2.4, 1.5, 0.4),
  new THREE.Vector3(-0.3, -0.3, 1.8),
  new THREE.Vector3(1.5, 1.6, 0.6),
  new THREE.Vector3(3.4, -1.0, 1.4),
  new THREE.Vector3(4.6, 1.3, 0.3),
]

const bgPositionsBack = [
  new THREE.Vector3(-5.5, 0.5, -3.0),
  new THREE.Vector3(-2.0, -1.8, -3.5),
  new THREE.Vector3(1.0, 1.8, -2.8),
  new THREE.Vector3(3.5, -0.5, -3.2),
  new THREE.Vector3(5.5, 0.8, -2.6),
]

function BackgroundScene({ mountRef }: { mountRef: React.MutableRefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x0a0f1c, 0.06)

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 100)
    camera.position.set(0, 1.4, 9)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    mount.appendChild(renderer.domElement)

    const root = new THREE.Group()
    scene.add(root)
    const backGroup = new THREE.Group()
    scene.add(backGroup)

    scene.add(new THREE.AmbientLight(0x9fb7ff, 0.4))
    const key = new THREE.PointLight(0x2fe3c4, 3.5, 20)
    key.position.set(-3, 4, 5)
    scene.add(key)
    const rim = new THREE.PointLight(0xf2a93b, 2.4, 20)
    rim.position.set(4, -1, 4)
    scene.add(rim)
    const back = new THREE.PointLight(0xf0555c, 1.6, 22)
    back.position.set(0, 0, -4)
    scene.add(back)

    bgPositionsFront.forEach((position, index) => {
      const isHub = index === 2
      const isWarn = index === 1
      const isCritical = index === 4
      const material = isHub
        ? bgHubMaterial
        : isWarn
        ? bgWarnMaterial
        : isCritical
        ? bgCriticalMaterial
        : bgNodeMaterial
      const mesh = new THREE.Mesh(isHub ? bgHubGeometry : bgNodeGeometry, material)
      mesh.position.copy(position)
      mesh.userData.spin = 0.004 + index * 0.0009
      root.add(mesh)
    })

    const lineGeo = new THREE.BufferGeometry().setFromPoints(bgPositionsFront)
    root.add(new THREE.Line(lineGeo, bgLineMaterial))

    const backNodeGeo = new THREE.IcosahedronGeometry(0.2, 1)
    const backNodeMat = new THREE.MeshStandardMaterial({
      color: 0x8593af,
      emissive: 0x22314d,
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
      opacity: 0.4,
    })
    bgPositionsBack.forEach((position, index) => {
      const mesh = new THREE.Mesh(backNodeGeo, backNodeMat)
      mesh.position.copy(position)
      mesh.userData.spin = 0.002 + index * 0.0005
      backGroup.add(mesh)
    })

    const packets = bgPositionsFront.slice(0, -1).map((position, index) => {
      const packet = new THREE.Mesh(bgPacketGeometry, index === 3 ? bgCriticalMaterial : bgPacketMaterial)
      packet.position.copy(position)
      packet.userData.segment = index
      packet.userData.progress = index * 0.16
      root.add(packet)
      return packet
    })

    const particleCount = 220
    const particleGeo = new THREE.BufferGeometry()
    const particleArr = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i += 1) {
      particleArr[i * 3] = (Math.random() - 0.5) * 16
      particleArr[i * 3 + 1] = (Math.random() - 0.5) * 9
      particleArr[i * 3 + 2] = (Math.random() - 0.5) * 7
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particleArr, 3))
    const particles = new THREE.Points(particleGeo, bgParticleMaterial)
    scene.add(particles)

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    const onMouse = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect()
      mouse.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      mouse.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2
    }
    window.addEventListener('mousemove', onMouse)

    const resize = () => {
      if (!mount) return
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    resize()
    window.addEventListener('resize', resize)

    const clock = new THREE.Clock()
    let frame = 0
    const animate = () => {
      const t = clock.getElapsedTime()
      mouse.x += (mouse.tx - mouse.x) * 0.04
      mouse.y += (mouse.ty - mouse.y) * 0.04

      camera.position.x = mouse.x * 0.4
      camera.position.y = 1.4 - mouse.y * 0.25
      camera.lookAt(0, 0, 0)

      root.rotation.y = Math.sin(t * 0.12) * 0.12 - mouse.x * 0.08
      root.rotation.x = Math.sin(t * 0.09) * 0.04 + mouse.y * 0.05

      backGroup.rotation.y = -t * 0.03 + mouse.x * 0.15
      backGroup.rotation.x = Math.sin(t * 0.05) * 0.02 - mouse.y * 0.1

      root.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.userData.spin && !(child instanceof THREE.Line)) {
          if (child.geometry === bgPacketGeometry) return
          child.rotation.x += child.userData.spin
          child.rotation.y += child.userData.spin * 1.3
        }
      })

      backGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.userData.spin) {
          child.rotation.x += child.userData.spin
          child.rotation.y += child.userData.spin * 1.2
        }
      })

      packets.forEach((packet) => {
        const segment = packet.userData.segment as number
        const from = bgPositionsFront[segment]
        const to = bgPositionsFront[segment + 1]
        const progress = ((t * 0.18 + packet.userData.progress) % 1)
        packet.position.lerpVectors(from, to, progress)
        const pulse = 0.75 + Math.sin(progress * Math.PI * 2) * 0.2
        packet.scale.setScalar(pulse)
        packet.rotation.x += 0.05
        packet.rotation.y += 0.05
      })

      particles.rotation.y = t * 0.012
      particles.rotation.x = Math.sin(t * 0.04) * 0.015

      renderer.render(scene, camera)
      frame = window.requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
      window.cancelAnimationFrame(frame)
      if (renderer.domElement.parentNode) {
        mount.removeChild(renderer.domElement)
      }
      renderer.dispose()
      bgNodeGeometry.dispose()
      bgHubGeometry.dispose()
      bgPacketGeometry.dispose()
      backNodeGeo.dispose()
      particleGeo.dispose()
      lineGeo.dispose()
      bgNodeMaterial.dispose()
      bgHubMaterial.dispose()
      bgWarnMaterial.dispose()
      bgCriticalMaterial.dispose()
      bgLineMaterial.dispose()
      bgPacketMaterial.dispose()
      bgParticleMaterial.dispose()
      backNodeMat.dispose()
    }
  }, [mountRef])

  return null
}

/* ──────────────────────────────────────────────
   ANIMATED ROTATING LOGO RING
   ────────────────────────────────────────────── */
function BrandMark() {
  return (
    <div className="relative h-16 w-16 shrink-0">
      {/* Outer rotating dashed ring */}
      <div
        className="absolute inset-0 rounded-full border border-dashed border-signal/40"
        style={{ animation: 'spin-slow 24s linear infinite' }}
      />
      {/* Middle counter-rotating ring */}
      <div
        className="absolute inset-1.5 rounded-full border border-alert/30"
        style={{
          borderTopColor: 'rgba(242,169,59,0.7)',
          borderRightColor: 'rgba(242,169,59,0.5)',
          animation: 'spin-reverse 18s linear infinite',
        }}
      />
      {/* Center disc with logo */}
      <div className="absolute inset-3 flex items-center justify-center rounded-full bg-gradient-to-br from-panel to-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_20px_rgba(47,227,196,0.2)]">
        <NetworkMark className="h-7 w-7 text-signal" />
      </div>
      {/* Pulse dot */}
      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse-dot rounded-full bg-signal shadow-[0_0_10px_rgba(47,227,196,0.8)]" />
    </div>
  )
}

/* ──────────────────────────────────────────────
   TYPEWRITER STATUS LINE
   ────────────────────────────────────────────── */
const STATUS_LINES = [
  'Syncing SKUs across 6 distribution centers…',
  'FEFO batches ranked, 2 expiring within 48h…',
  'Demand signal spike detected in zone B-3…',
  'Touchless rate 87% — target 90% within reach…',
  'Three-way match ready for 14 pending invoices…',
]

function TypewriterLine() {
  const [lineIndex, setLineIndex] = useState(0)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const target = STATUS_LINES[lineIndex]
    const isTyping = !deleting
    const speed = isTyping ? 38 : 22
    const timer = setTimeout(() => {
      if (isTyping) {
        const next = target.slice(0, text.length + 1)
        setText(next)
        if (next === target) {
          setTimeout(() => setDeleting(true), 1800)
        }
      } else {
        const next = target.slice(0, text.length - 1)
        setText(next)
        if (next.length === 0) {
          setDeleting(false)
          setLineIndex((i) => (i + 1) % STATUS_LINES.length)
        }
      }
    }, speed)
    return () => clearTimeout(timer)
  }, [text, deleting, lineIndex])

  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-mist/70">
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse-dot rounded-full bg-signal shadow-[0_0_6px_rgba(47,227,196,0.7)]" />
      <span className="truncate">
        {text}
        <span className="ml-0.5 inline-block h-3 w-1.5 -translate-y-px animate-pulse bg-signal/70" />
      </span>
    </div>
  )
}

/* ──────────────────────────────────────────────
   LIVE STATUS PILLS (animated count-up)
   ────────────────────────────────────────────── */
function StatusPill() {
  const [skus, setSkus] = useState(248)
  const [alerts, setAlerts] = useState(3)
  const [touchless, setTouchless] = useState(87)

  useEffect(() => {
    const t = setInterval(() => {
      setSkus((v) => v + Math.floor(Math.random() * 3) - 1)
      setAlerts((v) => Math.max(0, v + (Math.random() > 0.7 ? 1 : Math.random() > 0.5 ? -1 : 0)))
      setTouchless((v) => Math.max(60, Math.min(99, v + (Math.random() > 0.5 ? 1 : -1))))
    }, 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: 'SKUs', value: skus, tone: 'signal' as const, suffix: '' },
        { label: 'Alerts', value: alerts, tone: alerts > 0 ? ('alert' as const) : ('signal' as const), suffix: '' },
        { label: 'Touchless', value: touchless, tone: 'signal' as const, suffix: '%' },
      ].map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-white/10 bg-white/[0.03] p-2 backdrop-blur-md transition-colors hover:border-signal/30"
        >
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-mist/60">{stat.label}</p>
          <p
            className={`mt-0.5 font-display text-base font-semibold tabular-nums ${
              stat.tone === 'signal' ? 'text-signal' : 'text-alert'
            }`}
          >
            {stat.value.toLocaleString()}
            <span className="text-[10px] text-mist/60">{stat.suffix}</span>
          </p>
        </div>
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────────
   MAIN LOGIN PAGE
   ────────────────────────────────────────────── */
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, role, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [mounted, setMounted] = useState(false)
  const bgMountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const locationState = location.state as LocationState | null
  const configured = Boolean(supabaseClient)

  if (!loading && user) {
    return <Navigate to={homeForRole(role)} replace />
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabaseClient) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    })

    setSubmitting(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    const { data: profile } = data.user
      ? await supabaseClient.from('users').select('role').eq('id', data.user.id).maybeSingle<{ role: AuthRole }>()
      : { data: null }

    navigate(locationState?.from?.pathname ?? homeForRole(profile?.role ?? null), { replace: true })
  }

  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-ink text-paper">
      {/* Animated 3D background */}
      <div ref={bgMountRef} className="absolute inset-0" aria-hidden="true" />
      <BackgroundScene mountRef={bgMountRef} />

      {/* Cinematic atmospheric overlays */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(10,15,28,0.4)_50%,rgba(10,15,28,0.95)_100%)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,15,28,0.4)_0%,transparent_30%,transparent_70%,rgba(10,15,28,0.6)_100%)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(34,49,77,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,49,77,0.08)_1px,transparent_1px)] bg-[size:64px_64px] opacity-40"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(47,227,196,0.08),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(242,169,59,0.06),transparent_45%)]"
        aria-hidden="true"
      />

      {/* Scanlines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px)',
        }}
        aria-hidden="true"
      />

      {/* Film grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E\")",
        }}
        aria-hidden="true"
      />

      {/* Top header bar — always visible */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between border-b border-white/5 bg-ink/30 px-5 py-2 backdrop-blur-md md:px-8">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <div>
            <p className="font-display text-sm font-semibold tracking-tight text-paper">CHAINVISION</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-mist/70">MedCare Pharma</p>
          </div>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <TypewriterLine />
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mist/60">
          <span className="hidden sm:inline">v1.0</span>
          <span className="hidden h-3 w-px bg-mist/20 sm:inline-block" />
          <span className="hidden sm:inline">C4</span>
        </div>
      </div>

      {/* Content grid */}
      <div
        className={`relative z-10 grid h-full w-full max-w-6xl grid-cols-1 items-center gap-4 px-5 py-14 transition-all duration-1000 md:grid-cols-12 md:gap-10 md:py-20 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Brand panel — desktop only */}
        <div className="hidden flex-col justify-center gap-5 md:col-span-7 md:flex">
          {/* Massive brand title with split lines */}
          <h1 className="font-display text-4xl font-semibold leading-[1.02] tracking-tight text-paper lg:text-5xl xl:text-6xl">
            <span className="block opacity-90">One operating</span>
            <span className="block opacity-90">view across the</span>
            <span className="block bg-gradient-to-r from-signal via-mist to-alert bg-clip-text pb-2 text-transparent">
              supply chain.
            </span>
          </h1>

          <p className="max-w-lg text-sm leading-relaxed text-mist">
            Demand sensing flows into replenishment decisions, then into DC stock and supplier exceptions —
            all in one continuous, AI-assisted control room.
          </p>

          {/* Live status pills — animated counts */}
          <div className="max-w-md">
            <StatusPill />
          </div>

          {/* Feature list with arrow indicators */}
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
            {[
              { label: 'Live inventory & expiry', sub: 'FEFO batches, multi-DC' },
              { label: 'FEFO replenishment', sub: 'EOQ + demand signals' },
              { label: 'Touchless P2P', sub: 'AI-assisted exceptions' },
              { label: 'Three-way match', sub: 'Real-time triage' },
            ].map((item) => (
              <li
                key={item.label}
                className="group flex items-center gap-2.5 rounded-md border border-transparent px-1.5 py-1 transition-all hover:border-white/5 hover:bg-white/[0.02]"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-signal/20 bg-signal/5 text-signal transition-all group-hover:border-signal/40 group-hover:bg-signal/10">
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-paper">{item.label}</p>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-mist/60">{item.sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Login card — right side */}
        <div className="flex items-center justify-center md:col-span-5">
          <div className="w-full max-w-sm">
            {/* Glass card with cinematic border + glow */}
            <div className="relative">
              {/* Animated gradient halo behind card */}
              <div
                className="absolute -inset-1 rounded-2xl opacity-50 blur-xl"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(47,227,196,0.5), rgba(242,169,59,0.25), rgba(47,227,196,0.35), rgba(95,166,255,0.25))',
                  backgroundSize: '300% 300%',
                  animation: 'gradient-shift 8s ease infinite',
                }}
                aria-hidden="true"
              />

              <div
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 shadow-2xl shadow-ink/70 backdrop-blur-2xl sm:p-7"
                style={{
                  boxShadow:
                    '0 0 0 1px rgba(255,255,255,0.04), 0 25px 80px -10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                {/* Top shimmer line */}
                <div
                  className="pointer-events-none absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-signal/70 to-transparent"
                  aria-hidden="true"
                />
                {/* Right edge accent */}
                <div
                  className="pointer-events-none absolute right-0 top-12 h-24 w-px bg-gradient-to-b from-transparent via-signal/40 to-transparent"
                  aria-hidden="true"
                />

                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-display text-2xl font-semibold tracking-tight text-paper">Sign in</h2>
                    <p className="mt-1 text-sm text-mist">Access the live planning and procurement network.</p>
                  </div>
                  {/* Lock icon badge */}
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-signal/20 bg-signal/5 text-signal">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                </div>

                <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist">Email</span>
                    <div className="relative mt-1.5">
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                        autoComplete="email"
                        disabled={submitting || !configured}
                        required
                        placeholder="admin@demo.com"
                        className="w-full rounded-lg border border-white/10 bg-ink/40 px-3 py-2.5 text-sm text-paper outline-none transition-all duration-300 placeholder:text-mist/40 focus:border-signal/50 focus:bg-ink/60 focus:ring-2 focus:ring-signal/20 focus:shadow-[0_0_20px_rgba(47,227,196,0.15)] disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      {emailFocused && email && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-signal animate-rise-in">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </label>

                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist">Password</span>
                    <div className="relative mt-1.5">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                        autoComplete="current-password"
                        disabled={submitting || !configured}
                        required
                        placeholder="••••••••"
                        className="w-full rounded-lg border border-white/10 bg-ink/40 px-3 py-2.5 pr-11 text-sm text-paper outline-none transition-all duration-300 placeholder:text-mist/40 focus:border-signal/50 focus:bg-ink/60 focus:ring-2 focus:ring-signal/20 focus:shadow-[0_0_20px_rgba(47,227,196,0.15)] disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={submitting || !configured}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-mist transition-all hover:bg-white/5 hover:text-signal disabled:opacity-40"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </label>

                  {!configured && (
                    <p className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical" role="alert">
                      Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
                    </p>
                  )}

                  {error && (
                    <div
                      className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical animate-shake"
                      role="alert"
                    >
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !configured}
                    className="group/btn relative mt-2 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-signal px-4 py-2.5 text-sm font-semibold text-ink shadow-[0_0_30px_rgba(47,227,196,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_50px_rgba(47,227,196,0.4)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                    aria-busy={submitting}
                  >
                    <span
                      className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full"
                      aria-hidden="true"
                    />
                    {submitting ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                          <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
                        </svg>
                        <span className="relative">Authenticating…</span>
                      </>
                    ) : (
                      <span className="relative inline-flex items-center gap-2">
                        Sign in
                        <svg className="h-3.5 w-3.5 transition-transform duration-300 group-hover/btn:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </span>
                    )}
                  </button>
                </form>

                <div className="mt-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-mist/50">Quick demo</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@demo.com')
                    setPassword('test1234')
                  }}
                  disabled={submitting}
                  className="group/cred mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-3 py-1.5 font-mono text-[10px] text-mist/80 transition-all duration-200 hover:border-signal/30 hover:bg-signal/5 hover:text-signal disabled:opacity-50"
                >
                  <span>admin@demo.com</span>
                  <span className="text-mist/40 group-hover/cred:text-signal/60">/</span>
                  <span>test1234</span>
                  <svg
                    className="h-3 w-3 text-mist/50 transition-transform duration-200 group-hover/cred:translate-x-0.5 group-hover/cred:text-signal"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-mist/40">
              MedCare Pharma &nbsp;•&nbsp; CHAINVISION Platform
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
