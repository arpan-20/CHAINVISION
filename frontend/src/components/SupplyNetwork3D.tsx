import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/* ──────────────────────────────────────────────
   3D SUPPLY NETWORK — animated background for overview hero
   ────────────────────────────────────────────── */
const SCENE_NODES = [
  { id: 0, position: [-4.5, -1.6, 1.4], color: 0x2fe3c4, size: 0.32, kind: 'dc' as const },
  { id: 1, position: [-2.4, 1.5, 0.5], color: 0xf2a93b, size: 0.3, kind: 'warehouse' as const },
  { id: 2, position: [-0.2, -0.2, 1.6], color: 0xeef1f7, size: 0.42, kind: 'hub' as const },
  { id: 3, position: [1.6, 1.7, 0.6], color: 0x2fe3c4, size: 0.3, kind: 'supplier' as const },
  { id: 4, position: [3.5, -1.0, 1.3], color: 0xf0555c, size: 0.3, kind: 'risk' as const },
  { id: 5, position: [4.7, 1.4, 0.3], color: 0x2fe3c4, size: 0.32, kind: 'dc' as const },
]

interface SupplyNetwork3DProps {
  height?: number
  className?: string
}

export default function SupplyNetwork3D({ height = 320, className = '' }: SupplyNetwork3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 100)
    camera.position.set(0, 1.2, 8)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    mount.appendChild(renderer.domElement)

    const root = new THREE.Group()
    scene.add(root)

    scene.add(new THREE.AmbientLight(0x9fb7ff, 0.4))
    const key = new THREE.PointLight(0x2fe3c4, 3.0, 20)
    key.position.set(-3, 4, 5)
    scene.add(key)
    const rim = new THREE.PointLight(0xf2a93b, 2.0, 20)
    rim.position.set(4, -1, 4)
    scene.add(rim)

    // Nodes
    const nodeGeo = new THREE.IcosahedronGeometry(1, 2)
    const hubGeo = new THREE.BoxGeometry(1, 1, 1)
    const meshes: THREE.Mesh[] = []

    SCENE_NODES.forEach((n) => {
      const material = new THREE.MeshStandardMaterial({
        color: n.color,
        emissive: n.color,
        emissiveIntensity: 0.4,
        metalness: 0.5,
        roughness: 0.3,
      })
      const isHub = n.kind === 'hub'
      const mesh = new THREE.Mesh(isHub ? hubGeo : nodeGeo, material)
      mesh.scale.setScalar(n.size)
      mesh.position.set(n.position[0], n.position[1], n.position[2])
      mesh.userData.spin = 0.004 + n.id * 0.0009
      root.add(mesh)
      meshes.push(mesh)
    })

    // Route lines
    const routePoints: THREE.Vector3[] = SCENE_NODES.map((n) => new THREE.Vector3(n.position[0], n.position[1], n.position[2]))
    const lineGeo = new THREE.BufferGeometry().setFromPoints(routePoints)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x2fe3c4, transparent: true, opacity: 0.25 })
    root.add(new THREE.Line(lineGeo, lineMat))

    // Animated packets
    const packetGeo = new THREE.OctahedronGeometry(0.16, 1)
    const packetMat = new THREE.MeshStandardMaterial({
      color: 0x2fe3c4,
      emissive: 0x0c514a,
      metalness: 0.5,
      roughness: 0.25,
    })
    const packets: THREE.Mesh[] = []
    for (let i = 0; i < routePoints.length - 1; i += 1) {
      const packet = new THREE.Mesh(packetGeo, packetMat)
      packet.position.copy(routePoints[i])
      packet.userData.segment = i
      packet.userData.progress = i * 0.18
      root.add(packet)
      packets.push(packet)
    }

    // Particles
    const particleCount = 160
    const particleGeo = new THREE.BufferGeometry()
    const particleArr = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i += 1) {
      particleArr[i * 3] = (Math.random() - 0.5) * 14
      particleArr[i * 3 + 1] = (Math.random() - 0.5) * 8
      particleArr[i * 3 + 2] = (Math.random() - 0.5) * 6
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particleArr, 3))
    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({
        color: 0x8593af,
        size: 0.02,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
      }),
    )
    scene.add(particles)

    // Mouse parallax
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
      mouse.x += (mouse.tx - mouse.x) * 0.05
      mouse.y += (mouse.ty - mouse.y) * 0.05

      camera.position.x = mouse.x * 0.4
      camera.position.y = 1.2 - mouse.y * 0.25
      camera.lookAt(0, 0, 0)

      root.rotation.y = Math.sin(t * 0.12) * 0.12 - mouse.x * 0.08
      root.rotation.x = Math.sin(t * 0.09) * 0.04 + mouse.y * 0.05

      meshes.forEach((m) => {
        m.rotation.x += m.userData.spin
        m.rotation.y += m.userData.spin * 1.3
      })

      packets.forEach((packet) => {
        const segment = packet.userData.segment as number
        const from = routePoints[segment]
        const to = routePoints[segment + 1]
        const progress = ((t * 0.2 + packet.userData.progress) % 1)
        packet.position.lerpVectors(from, to, progress)
        packet.scale.setScalar(0.7 + Math.sin(progress * Math.PI * 2) * 0.3)
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
      nodeGeo.dispose()
      hubGeo.dispose()
      packetGeo.dispose()
      particleGeo.dispose()
      lineGeo.dispose()
      packetMat.dispose()
      lineMat.dispose()
      meshes.forEach((m) => (m.material as THREE.Material).dispose())
    }
  }, [])

  return <div ref={mountRef} className={className} style={{ height, width: '100%' }} aria-hidden="true" />
}
