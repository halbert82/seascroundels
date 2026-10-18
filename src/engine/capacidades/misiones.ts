// Las reglas de las misiones (misiones 2.0) están escritas a mano por capítulo en src/engine/misiones2/ y se
// registran al cargar el motor. Aquí solo queda lo que se consulta desde fuera de la misión en curso.

import { reglasMision } from '../misiones2/registro.ts'
import type { CartaId } from '../tipos.ts'

/** Reputación necesaria para zarpar a una misión (0 si no pide ninguna). */
export function reputacionMinima(mision: CartaId): number {
  return reglasMision(mision)?.reputacionMinima ?? 0
}
