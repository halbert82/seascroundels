// Guardar y recuperar una partida como texto (para el navegador).

import { esCarta } from './catalogo.ts'
import { ZONAS, type Estado } from './tipos.ts'

export const CLAVE_GUARDADO = 'sea-scoundrels/partida'

export function serializar(s: Estado): string {
  return JSON.stringify(s)
}

/**
 * Recupera una partida guardada. Si es de una versión anterior del juego (le falta alguna zona o tiene cartas que ya no
 * existen, como los capítulos antiguos de las misiones), no se puede continuar.
 */
export function deserializar(texto: string): Estado {
  const datos: unknown = JSON.parse(texto)
  const anterior = () => new Error('La partida guardada no es de esta versión del juego')
  if (typeof datos !== 'object' || datos === null || (datos as { version?: unknown }).version !== 1) throw anterior()
  const s = datos as Estado
  if (!s.zonas || ZONAS.some((z) => !Array.isArray(s.zonas[z]))) throw anterior()
  if (Object.values(s.cartas ?? {}).some((c) => !esCarta(c.id))) throw anterior()
  return s
}
