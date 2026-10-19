// Ampliación de cartas: con ratón, al pasar por encima; con el dedo, al tocarla (o al mantenerla pulsada). Sale pegada
// a la carta, por el lado con sitio y sin salirse de la pantalla (ver colocacion.ts). Junto a ella, por el lado libre,
// se explican las palabras de regla, Estados y fichas que nombra. Con el dedo se cierra al tocar fuera; tocar la propia
// ampliación solo la cierra, sin tocar lo que haya debajo.
//
// Con el dedo, el primer toque sobre una carta solo la amplía: lo que la carta puede hacer sale como botones dentro de
// la ampliación («Reclutar», «Comprometer»…). Un segundo toque sobre la carta ya ampliada también lo hace, como un clic.
// Con el ratón no cambia nada: pasar por encima amplía y el clic hace la acción.

import { motion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as PointerEventReact, type ReactNode } from 'react'
import { porId } from '../../engine/catalogo.ts'
import { CartaEscalada, dimensiones } from '../cartas/Carta.tsx'
import { ayudasDeCarta } from '../textos/glosario.ts'
import { colocarAmpliacion, type Caja, type Colocacion } from './colocacion.ts'
import { enLienzo } from './disposicion.ts'
import { TarjetaAyuda } from './Explicacion.tsx'
import { duracion, useVelocidad } from './preferencias.ts'

/** Lo que tarda en salir al pasar el ratón (para que no parpadee al cruzar la mesa). */
const ESPERA_RATON = 180

interface CartaAmpliada {
  id: string
  /** La carta (o el rótulo) de la mesa junto al que sale. */
  ancla: HTMLElement
  /** Abierta con el dedo: recoge los toques (para cerrarla sin tocar lo de debajo) y se cierra al tocar fuera. */
  tactil: boolean
  /** Cambia con cada apertura (para animar la entrada). */
  vez: number
  /** Lo que puede hacer la carta (solo con el dedo): sale como botones en la ampliación. */
  acciones?: AccionesZoom
}

/** Las acciones de una carta, leídas al dibujar (así no se quedan viejas si la partida avanza con la carta ampliada). */
export interface AccionesZoom {
  /** Rótulos de los botones; vacío si ahora no puede hacer nada. */
  etiquetas: () => readonly string[]
  /** Hace la acción `opcion` (sin opción: como un clic en la carta). */
  hacer: (ancla: HTMLElement, opcion?: number) => void
}

interface OpcionesMostrar {
  /** Sin la espera del ratón. */
  inmediata?: boolean
  tactil?: boolean
  acciones?: AccionesZoom | undefined
}

interface ContextoZoom {
  mostrar: (id: string, elemento: HTMLElement, opciones?: OpcionesMostrar) => void
  ocultar: () => void
  /** La carta ampliada ahora mismo (sin redibujar a quien pregunta). */
  ampliadaAhora: () => CartaAmpliada | null
}

// Separados: las cartas solo necesitan mostrar y ocultar (que no cambian), y así no se redibujan al ampliar otra.
const Contexto = createContext<ContextoZoom | null>(null)
const ContextoAmpliada = createContext<CartaAmpliada | null>(null)

export function ProveedorZoom({ children }: { children: ReactNode }) {
  const [ampliada, setAmpliada] = useState<CartaAmpliada | null>(null)
  const actual = useRef<CartaAmpliada | null>(null)
  actual.current = ampliada
  const temporizador = useRef<number | null>(null)
  const veces = useRef(0)
  const parar = () => {
    if (temporizador.current) window.clearTimeout(temporizador.current)
    temporizador.current = null
  }
  const mostrar = useCallback((id: string, ancla: HTMLElement, { inmediata = false, tactil = false, acciones }: OpcionesMostrar = {}) => {
    parar()
    const abrir = () => {
      const a = actual.current
      if (a && a.id === id && a.ancla === ancla) {
        if (tactil && !a.tactil) setAmpliada({ ...a, tactil, ...(acciones ? { acciones } : {}) })
        return
      }
      veces.current += 1
      setAmpliada({ id, ancla, tactil, vez: veces.current, ...(tactil && acciones ? { acciones } : {}) })
    }
    if (inmediata) abrir()
    else temporizador.current = window.setTimeout(abrir, ESPERA_RATON)
  }, [])
  const ocultar = useCallback(() => {
    parar()
    setAmpliada(null)
  }, [])
  // Con el dedo no hay «salir con el ratón»: se cierra al tocar fuera de la ampliación y de su carta (lo que toques fuera
  // sigue haciendo lo suyo). También con Escape.
  useEffect(() => {
    if (!ampliada) return
    const alTocar = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      const t = e.target
      if (t instanceof Node && ampliada.ancla.contains(t)) return
      if (t instanceof Element && t.closest('.capa-zoom')) return
      ocultar()
    }
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ocultar()
    }
    window.addEventListener('pointerdown', alTocar, true)
    window.addEventListener('keydown', alTeclear)
    return () => {
      window.removeEventListener('pointerdown', alTocar, true)
      window.removeEventListener('keydown', alTeclear)
    }
  }, [ampliada, ocultar])
  const ampliadaAhora = useCallback(() => actual.current, [])
  const acciones = useMemo(() => ({ mostrar, ocultar, ampliadaAhora }), [mostrar, ocultar, ampliadaAhora])
  return (
    <Contexto.Provider value={acciones}>
      <ContextoAmpliada.Provider value={ampliada}>{children}</ContextoAmpliada.Provider>
    </Contexto.Provider>
  )
}

export function useZoom(): ContextoZoom {
  const c = useContext(Contexto)
  if (!c) throw new Error('useZoom fuera de ProveedorZoom')
  return c
}

/**
 * Lo que hace ampliable una carta de la mesa: con el ratón, al pasar por encima; con el dedo, al tocarla o al mantenerla
 * pulsada. `alPulsar` va en el clic de la carta, antes de lo que haga ella: devuelve `true` si el toque solo amplía
 * (y entonces la carta no hace nada). `acciones`: lo que puede hacer la carta, para los botones de la ampliación.
 */
export function useAmpliable(id: string | null, acciones?: AccionesZoom) {
  const zoom = useZoom()
  const puntero = useRef('mouse')
  return {
    onPointerDown: (e: PointerEventReact<HTMLElement>) => {
      puntero.current = e.pointerType
    },
    onPointerEnter: (e: PointerEventReact<HTMLElement>) => {
      if (id && e.pointerType === 'mouse') zoom.mostrar(id, e.currentTarget)
    },
    onPointerLeave: (e: PointerEventReact<HTMLElement>) => {
      if (e.pointerType === 'mouse') zoom.ocultar()
    },
    onContextMenu: (e: MouseEvent<HTMLElement>) => {
      e.preventDefault()
      if (id) zoom.mostrar(id, e.currentTarget, { inmediata: true, tactil: puntero.current !== 'mouse', acciones })
    },
    alPulsar: (elemento: HTMLElement): boolean => {
      if (!id || puntero.current === 'mouse') return false
      const a = zoom.ampliadaAhora()
      const conAccion = (acciones?.etiquetas().length ?? 0) > 0
      // Segundo toque sobre la carta ya ampliada: hace lo que haría un clic.
      if (conAccion && a?.tactil && a.ancla === elemento) {
        zoom.ocultar()
        return false
      }
      zoom.mostrar(id, elemento, { inmediata: true, tactil: true, acciones })
      return true
    },
    /** Último tipo de puntero que la pulsó ('mouse', 'touch' o 'pen'). */
    puntero,
  }
}

/** Caja de la carta tal y como se ve: si está girada (agotada), la girada. */
function cajaVisible(ancla: HTMLElement): { caja: Caja; anchoLienzo: number; altoLienzo: number } {
  const giro = ancla.querySelector<HTMLElement>(':scope > .carta-giro')
  const a = enLienzo(giro ?? ancla)
  return { caja: { x: a.x, y: a.y, ancho: a.ancho, alto: a.alto }, anchoLienzo: a.anchoLienzo, altoLienzo: a.altoLienzo }
}

function misma(a: Colocacion | null, b: Colocacion): boolean {
  const r = (n: number) => Math.round(n)
  return (
    a !== null &&
    a.lado === b.lado &&
    a.reduccion === b.reduccion &&
    r(a.carta.x) === r(b.carta.x) &&
    r(a.carta.y) === r(b.carta.y) &&
    (a.ayudas === null) === (b.ayudas === null) &&
    (!a.ayudas || !b.ayudas || (r(a.ayudas.x) === r(b.ayudas.x) && r(a.ayudas.y) === r(b.ayudas.y) && a.ayudas.columnas === b.ayudas.columnas))
  )
}

const ORIGEN: Record<Colocacion['lado'], string> = { derecha: '0% 50%', izquierda: '100% 50%', arriba: '50% 100%', abajo: '50% 0%' }

/** La carta ampliada, pegada a su carta de la mesa, con la explicación de lo que nombra por el lado libre. */
export function CapaZoom() {
  const { ocultar } = useZoom()
  const ampliada = useContext(ContextoAmpliada)
  const velocidad = useVelocidad()
  const id = ampliada?.id ?? null
  const ayudas = useMemo(() => (id ? ayudasDeCarta(id) : []), [id])
  const una = useRef<HTMLDivElement>(null)
  const dos = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Colocacion | null>(null)

  const entrada = id ? porId(id) : null
  const medida = entrada ? dimensiones(entrada) : null
  const escala = medida && medida.ancho > 400 ? 0.82 : 0.92
  const ancho = medida ? medida.ancho * escala : 0
  const alto = medida ? medida.alto * escala : 0

  const colocar = useCallback(() => {
    if (!ampliada) return
    // La carta se ha ido de donde estaba (ha cambiado de zona): la ampliación se va con ella.
    if (!ampliada.ancla.isConnected) return ocultar()
    const { caja, anchoLienzo, altoLienzo } = cajaVisible(ampliada.ancla)
    const u = una.current
    const d = dos.current
    const r = colocarAmpliacion({
      original: caja,
      carta: { ancho, alto },
      ayudas: u ? { una: { ancho: u.offsetWidth, alto: u.offsetHeight }, dos: d ? { ancho: d.offsetWidth, alto: d.offsetHeight } : undefined } : null,
      limites: { x: 0, y: 0, ancho: anchoLienzo, alto: altoLienzo },
    })
    setPos((antes) => (misma(antes, r) ? antes : r))
  }, [ampliada, ancho, alto, ocultar])

  // Antes de pintarse (y tras cada cambio de la mesa, por si la carta se ha movido).
  useLayoutEffect(() => {
    colocar()
  })
  useEffect(() => {
    if (!ampliada) return
    // Las cartas de la mano suben al pasar por encima: se vuelve a colocar cuando han terminado de subir.
    const t = window.setTimeout(colocar, 220)
    window.addEventListener('scroll', colocar, true)
    window.addEventListener('resize', colocar)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('scroll', colocar, true)
      window.removeEventListener('resize', colocar)
    }
  }, [ampliada, colocar])

  if (!ampliada || !entrada) return null
  const t = duracion(velocidad, 0.13)
  const etiquetas = ampliada.tactil ? (ampliada.acciones?.etiquetas() ?? []) : []
  const hacer = (i: number) => {
    const { acciones, ancla } = ampliada
    ocultar()
    acciones?.hacer(ancla, i)
  }
  const tarjetas = ayudas.map((a) => <TarjetaAyuda key={a.clave} ayuda={a} className="compacta" />)
  const animar = t > 0 ? { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, transition: { duration: t, ease: 'easeOut' as const } } : {}
  return (
    <div
      className={`capa-zoom${ampliada.tactil ? ' tactil' : ''}`}
      {...(pos ? { 'data-lado': pos.lado } : {})}
      // Con el dedo, tocar la ampliación la cierra (y el toque no llega a lo de debajo).
      onClick={ampliada.tactil ? ocultar : undefined}
    >
      {ayudas.length > 0 && (
        <div className="zoom-medidas" aria-hidden="true">
          <div ref={una} className="zoom-ayudas">
            {tarjetas}
          </div>
          {ayudas.length > 3 && (
            <div ref={dos} className="zoom-ayudas dos-columnas">
              {tarjetas}
            </div>
          )}
        </div>
      )}
      {pos && (
        <>
          <motion.div key={`c${ampliada.vez}`} className="zoom-carta" style={{ left: pos.carta.x, top: pos.carta.y, transformOrigin: ORIGEN[pos.lado] }} {...animar}>
            <CartaEscalada entrada={entrada} escala={escala * (pos.reduccion ?? 1)} />
            {etiquetas.length > 0 && (
              <div className="zoom-acciones">
                {etiquetas.map((e, i) => (
                  <button
                    key={e}
                    type="button"
                    className="boton principal"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      hacer(i)
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
          {pos.ayudas && ayudas.length > 0 && (
            <motion.div
              key={`a${ampliada.vez}`}
              className={`zoom-ayudas${pos.ayudas.columnas === 2 ? ' dos-columnas' : ''}`}
              style={{ left: pos.ayudas.x, top: pos.ayudas.y }}
              aria-label="Reglas de esta carta"
              {...animar}
            >
              {tarjetas}
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
