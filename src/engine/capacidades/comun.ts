import { porId } from '../catalogo.ts'
import type { Entorno } from '../datos.ts'
import { copia } from '../estado.ts'
import type { Estado, InstId } from '../tipos.ts'

/** Entorno de una carta de misión en juego. */
export function entornoDeMision(s: Estado, mision: InstId): Entorno {
  const e = porId(copia(s, mision).id)
  if (e.tipo !== 'capitulo') throw new Error(`${e.id} no es una misión`)
  return e.carta.entorno
}
