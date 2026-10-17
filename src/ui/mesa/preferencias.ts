// Preferencias del jugador que se guardan en el navegador (no forman parte de la partida).

import { useSyncExternalStore } from 'react'

export type Velocidad = 'normal' | 'rapida' | 'sin'

const CLAVE_VELOCIDAD = 'sea-scoundrels/velocidad'
const oyentes = new Set<() => void>()

function leer(): Velocidad {
  try {
    const v = localStorage.getItem(CLAVE_VELOCIDAD)
    return v === 'rapida' || v === 'sin' ? v : 'normal'
  } catch {
    return 'normal'
  }
}

let actual: Velocidad = typeof localStorage === 'undefined' ? 'normal' : leer()

export function cambiarVelocidad(v: Velocidad): void {
  actual = v
  try {
    localStorage.setItem(CLAVE_VELOCIDAD, v)
  } catch {
    // Sin almacenamiento (ventana privada): la preferencia dura lo que la página.
  }
  for (const o of oyentes) o()
}

export function useVelocidad(): Velocidad {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o)
      return () => oyentes.delete(o)
    },
    () => actual,
  )
}

/** Duración de una animación en segundos según la velocidad elegida (0 = sin animación). */
export function duracion(v: Velocidad, normal: number): number {
  return v === 'sin' ? 0 : v === 'rapida' ? normal * 0.5 : normal
}
