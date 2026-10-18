// Ampliación de cartas: con ratón, al pasar por encima; en pantallas táctiles, al mantenerla pulsada (y se quita al
// tocar en otro sitio). Junto a la carta ampliada se explican las palabras de regla, Estados y fichas que nombra.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { porId } from '../../engine/catalogo.ts'
import { CartaEscalada, dimensiones } from '../cartas/Carta.tsx'
import { ayudasDeCarta } from '../textos/glosario.ts'
import { enLienzo } from './disposicion.ts'
import { TarjetaAyuda } from './Explicacion.tsx'

interface CartaAmpliada {
  id: string
  /** La carta está en la mitad izquierda de la mesa: la ampliación va a la derecha (y al revés). */
  lado: 'izquierda' | 'derecha'
}

interface ContextoZoom {
  mostrar: (id: string, elemento: HTMLElement, inmediata?: boolean) => void
  ocultar: () => void
  ampliada: CartaAmpliada | null
}

const Contexto = createContext<ContextoZoom | null>(null)

export function ProveedorZoom({ children }: { children: ReactNode }) {
  const [ampliada, setAmpliada] = useState<CartaAmpliada | null>(null)
  const temporizador = useRef<number | null>(null)
  const mostrar = useCallback((id: string, elemento: HTMLElement, inmediata = false) => {
    if (temporizador.current) window.clearTimeout(temporizador.current)
    const p = enLienzo(elemento)
    const centro = p.x + p.ancho / 2
    temporizador.current = window.setTimeout(() => setAmpliada({ id, lado: centro < p.anchoLienzo / 2 ? 'izquierda' : 'derecha' }), inmediata ? 0 : 180)
  }, [])
  const ocultar = useCallback(() => {
    if (temporizador.current) window.clearTimeout(temporizador.current)
    setAmpliada(null)
  }, [])
  // En tableta no hay «salir con el ratón»: la ampliación se quita al volver a tocar la mesa.
  useEffect(() => {
    if (!ampliada) return
    const alTocar = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') ocultar()
    }
    window.addEventListener('pointerdown', alTocar, true)
    return () => window.removeEventListener('pointerdown', alTocar, true)
  }, [ampliada, ocultar])
  return <Contexto.Provider value={{ mostrar, ocultar, ampliada }}>{children}</Contexto.Provider>
}

export function useZoom(): ContextoZoom {
  const c = useContext(Contexto)
  if (!c) throw new Error('useZoom fuera de ProveedorZoom')
  return c
}

/** La carta ampliada, a un lado de la mesa (sin mover nada), con la explicación de lo que nombra hacia el centro. */
export function CapaZoom() {
  const { ampliada } = useZoom()
  const ayudas = useMemo(() => (ampliada ? ayudasDeCarta(ampliada.id) : []), [ampliada])
  if (!ampliada) return null
  const entrada = porId(ampliada.id)
  const { ancho } = dimensiones(entrada)
  const escala = ancho > 400 ? 0.82 : 0.92
  return (
    <div className={`capa-zoom ${ampliada.lado === 'izquierda' ? 'a-la-derecha' : 'a-la-izquierda'}`}>
      <div className="zoom-carta">
        <CartaEscalada entrada={entrada} escala={escala} />
      </div>
      {ayudas.length > 0 && (
        <div className={`zoom-ayudas${ayudas.length > 3 ? ' dos-columnas' : ''}`} aria-label="Reglas de esta carta">
          {ayudas.map((a) => (
            <TarjetaAyuda key={a.clave} ayuda={a} className="compacta" />
          ))}
        </div>
      )}
    </div>
  )
}
