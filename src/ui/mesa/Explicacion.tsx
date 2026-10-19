// Explicaciones de la mesa: al pasar el ratón por una ficha (un Estado, una Ventaja, una ficha de misión, «Rehén»…)
// o al pulsarla, sale una ventanita con su texto completo: qué hace y cómo se quita o cuándo termina.
// Con el ratón se cierra al salir; pulsada, se queda hasta que pulses fuera o Escape. No bloquea la partida: lo que
// pulses fuera sigue haciendo lo suyo.

import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NOMBRE_CLASE, type Ayuda } from '../textos/glosario.ts'
import { enLienzo } from './disposicion.ts'
import { duracion, useVelocidad } from './preferencias.ts'

/** Lo que tarda en salir al pasar el ratón (para que no parpadee al cruzar la mesa). */
const ESPERA_RATON = 120
const ANCHO = 330
const MARGEN = 10

interface Abierta {
  ayuda: Ayuda
  ancla: HTMLElement
  /** Pulsada: se queda abierta aunque el ratón se vaya. */
  fijada: boolean
  /** Cambia con cada apertura (para animar la entrada). */
  vez: number
}

interface ContextoExplicacion {
  abierta: Abierta | null
  pasar: (ayuda: Ayuda, ancla: HTMLElement) => void
  salir: (ancla: HTMLElement) => void
  pulsar: (ayuda: Ayuda, ancla: HTMLElement) => void
  /** Se cierra si está abierta sobre esa ficha (la ficha desaparece de la mesa). */
  soltar: (ancla: HTMLElement) => void
  cerrar: () => void
}

const Contexto = createContext<ContextoExplicacion | null>(null)

export function useExplicacion(): ContextoExplicacion {
  const c = useContext(Contexto)
  if (!c) throw new Error('useExplicacion fuera de ProveedorExplicacion')
  return c
}

export function ProveedorExplicacion({ children }: { children: ReactNode }) {
  const [abierta, setAbierta] = useState<Abierta | null>(null)
  const actual = useRef<Abierta | null>(null)
  actual.current = abierta
  const temporizador = useRef<number | null>(null)
  const veces = useRef(0)

  const parar = () => {
    if (temporizador.current) window.clearTimeout(temporizador.current)
    temporizador.current = null
  }
  const abrir = useCallback((ayuda: Ayuda, ancla: HTMLElement, fijada: boolean) => {
    parar()
    veces.current += 1
    setAbierta({ ayuda, ancla, fijada, vez: veces.current })
  }, [])
  const cerrar = useCallback(() => {
    parar()
    setAbierta(null)
  }, [])

  const valor = useMemo<ContextoExplicacion>(
    () => ({
      abierta,
      pasar: (ayuda, ancla) => {
        const a = actual.current
        if (a?.ancla === ancla) return
        parar()
        temporizador.current = window.setTimeout(() => abrir(ayuda, ancla, false), ESPERA_RATON)
      },
      salir: (ancla) => {
        parar()
        const a = actual.current
        if (a && !a.fijada && a.ancla === ancla) setAbierta(null)
      },
      pulsar: (ayuda, ancla) => {
        const a = actual.current
        // Pulsar la misma ficha otra vez la cierra; si solo estaba abierta por el ratón, la deja fijada.
        if (a?.ancla === ancla && a.fijada) return cerrar()
        if (a?.ancla === ancla) return setAbierta({ ...a, fijada: true })
        abrir(ayuda, ancla, true)
      },
      soltar: (ancla) => {
        if (actual.current?.ancla === ancla) cerrar()
      },
      cerrar,
    }),
    [abierta, abrir, cerrar],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

/** Una ficha o un rótulo de la mesa que se explica al pasar el ratón o al pulsarlo. */
export function Explicable({ ayuda, className = '', children, etiqueta }: { ayuda: Ayuda; className?: string; children: ReactNode; etiqueta?: string }) {
  const { abierta, pasar, salir, pulsar, soltar } = useExplicacion()
  const ref = useRef<HTMLButtonElement>(null)
  const soltarRef = useRef(soltar)
  soltarRef.current = soltar
  useEffect(() => {
    const el = ref.current
    return () => {
      if (el) soltarRef.current(el)
    }
  }, [])
  const abiertaAqui = abierta !== null && abierta.ancla === ref.current
  return (
    <button
      ref={ref}
      type="button"
      className={`explicable ${className}${abiertaAqui ? ' explicando' : ''}`}
      aria-expanded={abiertaAqui}
      aria-label={etiqueta ?? `${ayuda.nombre}: ver qué hace`}
      onPointerEnter={(e) => e.pointerType === 'mouse' && pasar(ayuda, e.currentTarget)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && salir(e.currentTarget)}
      onClick={(e) => {
        e.stopPropagation()
        pulsar(ayuda, e.currentTarget)
      }}
      onContextMenu={(e) => {
        // En tableta, mantener pulsado no abre el menú del navegador: abre la explicación.
        e.preventDefault()
        if (!abiertaAqui) pulsar(ayuda, e.currentTarget)
      }}
    >
      {children}
    </button>
  )
}

/** El texto completo de una explicación (en la ventanita, junto a una carta ampliada y en la Referencia rápida). */
export function TarjetaAyuda({ ayuda, className = '' }: { ayuda: Ayuda; className?: string }) {
  return (
    <div className={`tarjeta-ayuda clase-${ayuda.clase} ${className}`}>
      <div className="ta-cabecera">
        <span className="ta-clase">{NOMBRE_CLASE[ayuda.clase]}</span>
        <span className="ta-nombre">{ayuda.nombre}</span>
      </div>
      {ayuda.partes.map((p) => (
        <div key={p.rotulo} className="ta-parte">
          <span className="ta-rotulo">{p.rotulo}</span>
          <p>{p.texto}</p>
        </div>
      ))}
    </div>
  )
}

interface Posicion {
  left: number
  top: number
  /** Dónde queda respecto a la ficha. */
  lado: 'abajo' | 'arriba'
  /** Punta de la flecha, desde el borde izquierdo de la ventanita. */
  flecha: number
}

/** La ventanita, sobre todo lo demás, junto a la ficha que explica. */
export function CapaExplicacion() {
  const { abierta, cerrar } = useExplicacion()
  const velocidad = useVelocidad()
  const caja = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Posicion | null>(null)

  const colocar = useCallback(() => {
    const el = caja.current
    if (!abierta || !el || !abierta.ancla.isConnected) return
    const a = enLienzo(abierta.ancla)
    // offsetHeight ya está en unidades del lienzo (la escala del lienzo es una transformación).
    const alto = el.offsetHeight
    const abajo = a.y + a.alto + MARGEN
    const lado: Posicion['lado'] = abajo + alto <= a.altoLienzo - 8 || a.y - MARGEN - alto < 8 ? 'abajo' : 'arriba'
    const top = lado === 'abajo' ? Math.min(abajo, a.altoLienzo - 8 - alto) : a.y - MARGEN - alto
    const centro = a.x + a.ancho / 2
    const left = Math.max(8, Math.min(a.anchoLienzo - ANCHO - 8, centro - ANCHO / 2))
    setPos({ left, top: Math.max(8, top), lado, flecha: Math.max(16, Math.min(ANCHO - 16, centro - left)) })
  }, [abierta])

  useLayoutEffect(() => {
    setPos(null)
    colocar()
  }, [colocar])

  useEffect(() => {
    if (!abierta) return
    // Se cierra al pulsar fuera (sin impedir lo que hagas allí) o con Escape; sigue a su ficha si algo se desplaza.
    const alPulsar = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (t && (caja.current?.contains(t) || abierta.ancla.contains(t))) return
      cerrar()
    }
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('pointerdown', alPulsar, true)
    window.addEventListener('keydown', alTeclear)
    window.addEventListener('scroll', colocar, true)
    window.addEventListener('resize', colocar)
    return () => {
      window.removeEventListener('pointerdown', alPulsar, true)
      window.removeEventListener('keydown', alTeclear)
      window.removeEventListener('scroll', colocar, true)
      window.removeEventListener('resize', colocar)
    }
  }, [abierta, cerrar, colocar])

  const t = duracion(velocidad, 0.16)
  return (
    <AnimatePresence>
      {abierta && (
        <motion.div
          key={abierta.vez}
          // Al cambiar de ficha, la anterior se va animando: el ref no se suelta al desmontarla.
          ref={(el: HTMLDivElement | null) => {
            if (el) caja.current = el
          }}
          role="tooltip"
          className={`explicacion${abierta.fijada ? ' fijada' : ''}${pos ? ` hacia-${pos.lado}` : ''}`}
          style={{ width: ANCHO, left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden', transformOrigin: `${pos?.flecha ?? ANCHO / 2}px ${pos?.lado === 'arriba' ? '100%' : '0%'}` }}
          initial={t > 0 ? { opacity: 0, scale: 0.96 } : false}
          animate={{ opacity: 1, scale: 1 }}
          exit={t > 0 ? { opacity: 0, scale: 0.98, transition: { duration: t * 0.6 } } : { opacity: 0, transition: { duration: 0 } }}
          transition={{ duration: t, ease: 'easeOut' }}
        >
          <TarjetaAyuda ayuda={abierta.ayuda} />
          {pos && <span className="explicacion-flecha" style={{ left: pos.flecha }} />}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
