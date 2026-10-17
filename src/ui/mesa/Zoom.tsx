// Ampliación de cartas: con ratón, al pasar por encima; en pantallas táctiles, al tocar.

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { porId } from '../../engine/catalogo.ts'
import { CartaEscalada, dimensiones } from '../cartas/Carta.tsx'
import { ANCHO } from './Lienzo.tsx'

interface CartaAmpliada {
  id: string
  /** La carta está en la mitad izquierda de la mesa: la ampliación va a la derecha (y al revés). */
  lado: 'izquierda' | 'derecha'
}

interface ContextoZoom {
  mostrar: (id: string, elemento: HTMLElement) => void
  ocultar: () => void
  ampliada: CartaAmpliada | null
}

const Contexto = createContext<ContextoZoom | null>(null)

export function ProveedorZoom({ children }: { children: ReactNode }) {
  const [ampliada, setAmpliada] = useState<CartaAmpliada | null>(null)
  const temporizador = useRef<number | null>(null)
  const mostrar = useCallback((id: string, elemento: HTMLElement) => {
    if (temporizador.current) window.clearTimeout(temporizador.current)
    const lienzo = elemento.closest('.lienzo')
    const caja = elemento.getBoundingClientRect()
    const base = lienzo?.getBoundingClientRect()
    const escala = base ? base.width / ANCHO : 1
    const centro = base ? (caja.left + caja.width / 2 - base.left) / escala : 0
    temporizador.current = window.setTimeout(() => setAmpliada({ id, lado: centro < ANCHO / 2 ? 'izquierda' : 'derecha' }), 180)
  }, [])
  const ocultar = useCallback(() => {
    if (temporizador.current) window.clearTimeout(temporizador.current)
    setAmpliada(null)
  }, [])
  return <Contexto.Provider value={{ mostrar, ocultar, ampliada }}>{children}</Contexto.Provider>
}

export function useZoom(): ContextoZoom {
  const c = useContext(Contexto)
  if (!c) throw new Error('useZoom fuera de ProveedorZoom')
  return c
}

/** La carta ampliada, a un lado de la mesa (sin mover nada). */
export function CapaZoom() {
  const { ampliada } = useZoom()
  if (!ampliada) return null
  const entrada = porId(ampliada.id)
  const { ancho } = dimensiones(entrada)
  const escala = ancho > 400 ? 0.82 : 0.92
  return (
    <div className={`capa-zoom ${ampliada.lado === 'izquierda' ? 'a-la-derecha' : 'a-la-izquierda'}`}>
      <div className="zoom-carta">
        <CartaEscalada entrada={entrada} escala={escala} />
      </div>
    </div>
  )
}
