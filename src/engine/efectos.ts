// Interpreta los recuadros de efecto de los Peligros y las líneas Sin oposición tal y como se
// imprimen (iconos separados por « · »): «2 [herida] · 1 [agotar]», «1 [dano] · / 1 [herida]»…

import { DATOS } from './datos.ts'
import type { CartaId } from './tipos.ts'

export type Efecto =
  /** Heridas a un Tripulante. `capitan`: al Capitán. `soloEnTierra`: alternativa al daño fuera del Mar. */
  | { tipo: 'heridas'; n: number; capitan?: boolean; soloEnTierra?: boolean }
  /** Daño al Barco (solo en el Mar). `soloEnMar`: tiene alternativa en tierra. */
  | { tipo: 'dano'; n: number; soloEnMar?: boolean }
  | { tipo: 'reparar'; n: number }
  | { tipo: 'agotar'; n: number | 'todos' }
  | { tipo: 'descartar'; n: number }
  | { tipo: 'robar'; n: number }
  | { tipo: 'curar'; n: number }
  | { tipo: 'perderAvance'; n: number | 'todo' }
  | { tipo: 'perderMunicion'; n: number }
  | { tipo: 'perderMejora'; n: number }
  | { tipo: 'agotarMejora' }
  | { tipo: 'rehen' }
  | { tipo: 'reputacion'; n: number }
  | { tipo: 'menosMando' }
  | { tipo: 'perderDia' }
  | { tipo: 'entraEnMazo'; carta: CartaId }
  | { tipo: 'seRetira' }
  | { tipo: 'recluta' }
  | { tipo: 'sinFallo' }

function numero(texto: string): number {
  return Number(texto.replace('−', '-').replace('+', ''))
}

/** «La Armada» → «armada»: las cartas de Peligro que entran en el mazo durante la partida. */
function cartaQueEntra(nombre: string): CartaId {
  const carta = DATOS.peligros.find((p) => p.entraDuranteLaPartida && p.nombre.includes(nombre))
  if (!carta) throw new Error(`No hay ninguna carta de Peligro «${nombre}» que entre en el mazo`)
  return carta.id
}

export function interpretarEfectos(texto: string): Efecto[] {
  if (!texto.trim()) return []
  const efectos: Efecto[] = []
  for (const parte of texto.split(' · ').map((p) => p.trim())) {
    const conIcono = /^(\/\s*)?([+−-]?\d+|Todos|−Todo)\s*\[(\w+)\]$/.exec(parte)
    if (conIcono) {
      const [, barra, cantidad = '', icono] = conIcono
      if (barra) {
        // «1 [dano] · / 1 [herida]»: en tierra, la herida sustituye al daño.
        const anterior = efectos[efectos.length - 1]
        if (anterior?.tipo !== 'dano') throw new Error(`Alternativa «/» sin daño delante: ${texto}`)
        anterior.soloEnMar = true
        efectos.push({ tipo: 'heridas', n: numero(cantidad), soloEnTierra: true })
        continue
      }
      const n = cantidad === 'Todos' || cantidad === '−Todo' ? null : numero(cantidad)
      switch (icono) {
        case 'herida':
          efectos.push({ tipo: 'heridas', n: n ?? 0 })
          continue
        case 'dano':
          efectos.push(n !== null && n < 0 ? { tipo: 'reparar', n: -n } : { tipo: 'dano', n: n ?? 0 })
          continue
        case 'agotar':
          efectos.push({ tipo: 'agotar', n: n ?? 'todos' })
          continue
        case 'descartar':
          efectos.push({ tipo: 'descartar', n: n ?? 0 })
          continue
        case 'robar':
          efectos.push({ tipo: 'robar', n: n ?? 0 })
          continue
        case 'curar':
          efectos.push({ tipo: 'curar', n: n ?? 0 })
          continue
        case 'avance':
          efectos.push({ tipo: 'perderAvance', n: n === null ? 'todo' : -n })
          continue
        case 'municion':
          efectos.push({ tipo: 'perderMunicion', n: -(n ?? 0) })
          continue
        case 'mejora':
          // «−1 [mejora]»: pierdes una Mejora. «1 [mejora]» (tachada): agota una Mejora.
          efectos.push(n !== null && n < 0 ? { tipo: 'perderMejora', n: -n } : { tipo: 'agotarMejora' })
          continue
        case 'rehen':
          for (let i = 0; i < (n ?? 1); i++) efectos.push({ tipo: 'rehen' })
          continue
        case 'rep':
          efectos.push({ tipo: 'reputacion', n: n ?? 0 })
          continue
      }
      throw new Error(`Icono de efecto desconocido «${icono}» en: ${texto}`)
    }
    if (parte === 'Capitán') {
      const anterior = efectos[efectos.length - 1]
      if (anterior?.tipo !== 'heridas') throw new Error(`«Capitán» sin heridas delante: ${texto}`)
      anterior.capitan = true
      continue
    }
    if (parte === '−1 Mando') efectos.push({ tipo: 'menosMando' })
    else if (parte === '−1 día') efectos.push({ tipo: 'perderDia' })
    else if (parte === 'Se retira') efectos.push({ tipo: 'seRetira' })
    else if (parte === 'Recluta') efectos.push({ tipo: 'recluta' })
    else if (parte === 'Sin fallo') efectos.push({ tipo: 'sinFallo' })
    else {
      const entra = /^\+ «(.+)»$/.exec(parte)
      if (!entra?.[1]) throw new Error(`Efecto no reconocido «${parte}» en: ${texto}`)
      efectos.push({ tipo: 'entraEnMazo', carta: cartaQueEntra(entra[1]) })
    }
  }
  return efectos
}
