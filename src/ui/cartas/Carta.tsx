// Punto de entrada para dibujar cualquier carta de la caja.

import { useMemo } from 'react'
import type { EntradaCatalogo } from '../../engine/catalogo.ts'
import { CartaCapitulo } from './CartaCapitulo.tsx'
import { CartaJugador } from './CartaJugador.tsx'
import { CartaMazoPropio, CartaPeligro } from './CartaPeligro.tsx'
import { CartaMini } from './CartaMini.tsx'
import { CartaPuerto } from './CartaPuerto.tsx'
import { vistaDeCarta, type VistaCarta } from './vista.ts'
import './cartas.css'

/** Tamaño de las cartas en píxeles CSS, sin escalar (unos 6 px por milímetro). */
export const MEDIDAS = {
  /** Tamaño normal de LCG (63 × 88 mm). */
  normal: { ancho: 378, alto: 528 },
  /** Tamaño tarot (70 × 120 mm), fase 10c: las cartas de Peligro (también las de mazo propio) y la de puerto. */
  tarot: { ancho: 420, alto: 720 },
  /** Fase 16: carta mini (41 × 63 mm, como las mini de Arkham): los Estados y las Ventajas. */
  mini: { ancho: 246, alto: 378 },
} as const

/** Las cartas de Peligro, las de mazo propio y la de puerto van en tamaño tarot (fase 10c). */
export function esTarot(entrada: EntradaCatalogo): boolean {
  return entrada.tipo === 'peligro' || entrada.tipo === 'mazoPropio' || entrada.tipo === 'puerto'
}

/** Tamaño de la carta en píxeles CSS, sin escalar. */
export function dimensiones(entrada: EntradaCatalogo): { ancho: number; alto: number } {
  if (entrada.tipo === 'estado') return { ...MEDIDAS.mini }
  if (entrada.tipo === 'puerto') return { ancho: MEDIDAS.tarot.alto, alto: MEDIDAS.tarot.ancho }
  if (esTarot(entrada)) return { ...MEDIDAS.tarot }
  return entrada.tipo === 'capitulo' ? { ancho: MEDIDAS.normal.alto, alto: MEDIDAS.normal.ancho } : { ...MEDIDAS.normal }
}

/** El número del mazo de historia, bien visible en el anverso (fase 10). */
export function NumeroHistoria({ num }: { num: number }) {
  return (
    <div className="num-historia" title={`Mazo de historia: carta ${num}`}>
      <span className="nh-rotulo">Historia</span>
      <b>{num}</b>
    </div>
  )
}

export function DibujoCarta({ vista }: { vista: VistaCarta }) {
  const carta = dibujo(vista)
  // Los capítulos lo llevan en su pie («Mazo de historia»); las demás, en una pestaña al pie de la carta.
  if (!vista.historia || vista.forma === 'capitulo') return carta
  return (
    <div className="con-historia">
      {carta}
      <NumeroHistoria num={vista.historia.num} />
    </div>
  )
}

function dibujo(vista: VistaCarta) {
  switch (vista.forma) {
    case 'jugador':
      return <CartaJugador v={vista} />
    case 'peligro':
      return <CartaPeligro v={vista} />
    case 'mazoPropio':
      return <CartaMazoPropio v={vista} />
    case 'capitulo':
      return <CartaCapitulo v={vista} />
    case 'puerto':
      return <CartaPuerto v={vista} />
    case 'mini':
      return <CartaMini v={vista} />
  }
}

export function Carta({ entrada }: { entrada: EntradaCatalogo }) {
  const vista = useMemo(() => vistaDeCarta(entrada), [entrada])
  return <DibujoCarta vista={vista} />
}

/**
 * Carta escalada que ocupa exactamente su tamaño final en la maqueta. `zoom` (el reglamento): escala con la propiedad
 * zoom en vez de con una transformación, para que la caja de la carta mida lo que se ve. Al imprimir el PDF, Chromium
 * recortaba las cartas transformadas que caían al pie de una página (su caja sin escalar se salía de ella).
 */
export function CartaEscalada({ entrada, escala, zoom = false }: { entrada: EntradaCatalogo; escala: number; zoom?: boolean }) {
  const { ancho, alto } = dimensiones(entrada)
  return (
    <div style={{ width: ancho * escala, height: alto * escala, position: 'relative', flex: 'none' }}>
      <div style={zoom ? { position: 'absolute', left: 0, top: 0, zoom: escala } : { position: 'absolute', left: 0, top: 0, transform: `scale(${escala})`, transformOrigin: '0 0' }}>
        <Carta entrada={entrada} />
      </div>
    </div>
  )
}
