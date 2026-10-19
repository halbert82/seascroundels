// Estado de la partida en la interfaz: responde al motor, guarda en el navegador y permite deshacer.

import { useCallback, useEffect, useRef, useState } from 'react'
import { conHistorial, deshacer as deshacerMotor, jugar, puedeDeshacer, type Partida } from '../../engine/deshacer.ts'
import { CLAVE_GUARDADO, deserializar, serializar } from '../../engine/guardado.ts'
import { nuevaPartida } from '../../engine/preparacion.ts'
import type { Eleccion, Estado } from '../../engine/tipos.ts'

export interface PartidaEnMesa extends Partida {
  /** Longitud del registro antes de la última decisión: lo que viene después es «lo último que ha pasado». */
  desde: number
  /** Decisiones tomadas en esta sesión (para las pruebas de la interfaz). */
  jugadas?: number
}

export function partidaGuardada(): Estado | null {
  try {
    const texto = localStorage.getItem(CLAVE_GUARDADO)
    return texto ? deserializar(texto) : null
  } catch {
    return null
  }
}

export function borrarPartidaGuardada(): void {
  try {
    localStorage.removeItem(CLAVE_GUARDADO)
  } catch {
    // Sin almacenamiento disponible: no hay nada que borrar.
  }
}

function guardar(s: Estado): void {
  try {
    if (s.resultado) localStorage.removeItem(CLAVE_GUARDADO)
    else localStorage.setItem(CLAVE_GUARDADO, serializar(s))
  } catch {
    // Sin almacenamiento (ventana privada o lleno): se juega igual, solo que sin guardar.
  }
}

export function empezar(estado: Estado): PartidaEnMesa {
  return { ...conHistorial(estado), desde: estado.registro.length }
}

/** Una partida nueva con una semilla al azar. `sinEscenario`: partida de aprendizaje, con un contador de días. */
export function partidaNueva(op: { sinEscenario?: boolean } = {}): PartidaEnMesa {
  return empezar(nuevaPartida({ semilla: `${Date.now()}-${Math.random()}`, ...(op.sinEscenario ? { sinEscenario: true } : {}) }))
}

/**
 * La partida de la mesa. `guardarEnNavegador`: falso para las escenas de demostración.
 * Si el motor rechaza una elección (no debería pasar: la mesa solo ofrece lo legal), se avisa y no cambia nada.
 */
export function usePartida(inicial: () => PartidaEnMesa, guardarEnNavegador = true) {
  const [partida, setPartida] = useState<PartidaEnMesa>(inicial)
  const [error, setError] = useState<string | null>(null)
  const actual = useRef(partida)
  actual.current = partida

  useEffect(() => {
    if (guardarEnNavegador) guardar(partida.estado)
  }, [partida, guardarEnNavegador])

  const elegir = useCallback((e: Eleccion) => {
    const p = actual.current
    try {
      const siguiente = jugar(p, e)
      setError(null)
      setPartida({ ...siguiente, desde: p.estado.registro.length, jugadas: (p.jugadas ?? 0) + 1 })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const deshacer = useCallback(() => {
    const p = actual.current
    const anterior = deshacerMotor(p)
    setPartida({ ...anterior, desde: Math.min(p.desde, anterior.estado.registro.length) })
  }, [])

  const reiniciar = useCallback((p: PartidaEnMesa) => setPartida(p), [])

  return { partida, estado: partida.estado, elegir, deshacer, puedeDeshacer: puedeDeshacer(partida), reiniciar, error }
}
