// Punto de entrada para dibujar cualquier carta de la caja.

import { useMemo } from 'react'
import type { EntradaCatalogo } from '../../engine/catalogo.ts'
import { CartaCapitulo } from './CartaCapitulo.tsx'
import { CartaJugador } from './CartaJugador.tsx'
import { CartaMazoPropio, CartaPeligro } from './CartaPeligro.tsx'
import { CartaPuerto } from './CartaPuerto.tsx'
import { vistaDeCarta, type VistaCarta } from './vista.ts'
import './cartas.css'

/** Tamaño de la carta en píxeles CSS, sin escalar. */
export function dimensiones(entrada: EntradaCatalogo): { ancho: number; alto: number } {
  return entrada.tipo === 'capitulo' || entrada.tipo === 'puerto' ? { ancho: 528, alto: 378 } : { ancho: 378, alto: 528 }
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
  }
}

export function Carta({ entrada }: { entrada: EntradaCatalogo }) {
  const vista = useMemo(() => vistaDeCarta(entrada), [entrada])
  return <DibujoCarta vista={vista} />
}

/** Carta escalada que ocupa exactamente su tamaño final en la maqueta. */
export function CartaEscalada({ entrada, escala }: { entrada: EntradaCatalogo; escala: number }) {
  const { ancho, alto } = dimensiones(entrada)
  return (
    <div style={{ width: ancho * escala, height: alto * escala, position: 'relative', flex: 'none' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${escala})`, transformOrigin: '0 0' }}>
        <Carta entrada={entrada} />
      </div>
    </div>
  )
}
