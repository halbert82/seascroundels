// Deshacer: se guardan fotos del estado fuera de la partida y se borran en cuanto se revela
// información nueva (robar, revelar, barajar, mirar un mazo).

import { responder } from './motor.ts'
import type { Eleccion, Estado } from './tipos.ts'

const MAXIMO_FOTOS = 50

export interface Partida {
  estado: Estado
  /** Estados anteriores que se pueden recuperar (el último es el más reciente). */
  anteriores: Estado[]
}

export function conHistorial(estado: Estado): Partida {
  return { estado, anteriores: [] }
}

/** Responde a la decisión pendiente y apunta la foto para deshacer, si no se ha revelado nada nuevo. */
export function jugar(p: Partida, eleccion: Eleccion): Partida {
  const nuevo = responder(p.estado, eleccion)
  const sinNovedades = nuevo.infoRevelada === p.estado.infoRevelada
  return { estado: nuevo, anteriores: sinNovedades ? [...p.anteriores, p.estado].slice(-MAXIMO_FOTOS) : [] }
}

export function puedeDeshacer(p: Partida): boolean {
  return p.anteriores.length > 0
}

export function deshacer(p: Partida): Partida {
  const anterior = p.anteriores[p.anteriores.length - 1]
  if (!anterior) return p
  return { estado: anterior, anteriores: p.anteriores.slice(0, -1) }
}
