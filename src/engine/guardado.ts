// Guardar y recuperar una partida como texto (para el navegador).

import type { Estado } from './tipos.ts'

export const CLAVE_GUARDADO = 'sea-scoundrels/partida'

export function serializar(s: Estado): string {
  return JSON.stringify(s)
}

export function deserializar(texto: string): Estado {
  const datos: unknown = JSON.parse(texto)
  if (typeof datos !== 'object' || datos === null || (datos as { version?: unknown }).version !== 1) {
    throw new Error('La partida guardada no es de esta versión del juego')
  }
  return datos as Estado
}
