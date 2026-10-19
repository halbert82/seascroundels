// La mesa mide siempre 900 de alto y entre 1440 y 1920 de ancho, según la forma de la pantalla, y se escala entera
// para caber. Así, en 1920×1080 la mesa se ensancha (y sus cartas crecen) en vez de dejar bandas a los lados.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export const ANCHO = 1440
export const ANCHO_MAXIMO = 1920
export const ALTO = 900

interface Medida {
  /** Ancho lógico de la mesa (1440–1920). */
  ancho: number
  escala: number
}

function medir(ventanaAncho: number, ventanaAlto: number): Medida {
  const ancho = Math.max(ANCHO, Math.min(ANCHO_MAXIMO, Math.round((ALTO * ventanaAncho) / ventanaAlto)))
  return { ancho, escala: Math.min(ventanaAncho / ancho, ventanaAlto / ALTO) }
}

const Contexto = createContext<Medida>({ ancho: ANCHO, escala: 1 })

export function useLienzo(): Medida {
  return useContext(Contexto)
}

export function Lienzo({ children }: { children: ReactNode }) {
  const [medida, setMedida] = useState(() => medir(window.innerWidth, window.innerHeight))
  useEffect(() => {
    const alCambiar = () => setMedida(medir(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', alCambiar)
    return () => window.removeEventListener('resize', alCambiar)
  }, [])
  // La página y la mesa no se desplazan nunca: solo las zonas hechas para ello (con «overflow: auto»), como el
  // centro o el registro. Si algo desplaza otra cosa (un «scrollIntoView», el foco…), vuelve a su sitio.
  useEffect(() => {
    const alDesplazar = (e: Event) => {
      const el = e.target
      if (el === document || el === document.documentElement || el === document.body) {
        if (window.scrollX || window.scrollY) window.scrollTo(0, 0)
        return
      }
      if (!(el instanceof HTMLElement) || !el.closest('.lienzo-marco')) return
      if (!el.scrollTop && !el.scrollLeft) return
      const { overflowX, overflowY } = getComputedStyle(el)
      if (/auto|scroll/.test(overflowX + overflowY)) return
      el.scrollTop = 0
      el.scrollLeft = 0
    }
    document.addEventListener('scroll', alDesplazar, true)
    return () => document.removeEventListener('scroll', alDesplazar, true)
  }, [])
  const { ancho, escala } = medida
  return (
    <Contexto.Provider value={medida}>
      <div className="lienzo-marco">
        {/* La barra superior sigue de lado a lado aunque la mesa no ocupe todo el ancho. */}
        <div className="franja-superior" style={{ top: (window.innerHeight - ALTO * escala) / 2, height: 58 * escala }} />
        <div className="lienzo" style={{ width: ancho, height: ALTO, transform: `translate(-50%, -50%) scale(${escala})` }}>
          {children}
        </div>
      </div>
    </Contexto.Provider>
  )
}
