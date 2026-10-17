// Escenas fijas de la mesa para las capturas y para enseñar la mesa en un momento concreto:
// se juega una partida con el jugador automático y una semilla fija hasta llegar al momento buscado.

import { responder } from '../../engine/motor.ts'
import { nuevaPartida } from '../../engine/preparacion.ts'
import { jugadorConCriterio } from '../../engine/pruebas/jugadores.ts'
import type { Estado } from '../../engine/tipos.ts'
import { empezar, type PartidaEnMesa } from './usePartida.ts'

export const ESCENAS = ['puerto', 'prueba', 'finMision'] as const
export type Escena = (typeof ESCENAS)[number]

function buscar(semilla: number, hasta: (s: Estado, desde: number) => boolean): PartidaEnMesa | null {
  const jugador = jugadorConCriterio()
  let s = nuevaPartida({ semilla })
  let desde = s.registro.length
  for (let n = 0; !s.resultado && n < 6000; n++) {
    if (hasta(s, desde)) return { ...empezar(s), desde }
    desde = s.registro.length
    const d = s.pendiente
    if (!d) return null
    s = responder(s, jugador(s, d))
  }
  return null
}

const CONDICION: Record<Escena, (s: Estado, desde: number) => boolean> = {
  // En puerto, en Jugar cartas, con algo de partida ya jugada.
  puerto: (s) => s.turno >= 3 && s.pendiente?.motivo.clave === 'jugarCartas' && s.zonas.tripulacion.length >= 3,
  // Una Prueba con comprometidos y el Destino revelado, en la ventana de acción.
  prueba: (s) =>
    s.turno >= 2 && s.pendiente?.motivo.clave === 'ventanaPrueba' && (s.prueba?.comprometidos.length ?? 0) >= 2 && s.zonas.mano.length >= 2,
  // Justo después de superar una misión.
  finMision: (s, desde) => s.turno >= 2 && s.registro.slice(desde).some((r) => r.dato?.tipo === 'finMision' && r.dato.resultado === 'superada'),
}

export function escena(nombre: Escena): PartidaEnMesa {
  for (let semilla = 1; semilla < 60; semilla++) {
    const p = buscar(semilla, CONDICION[nombre])
    if (p) return p
  }
  throw new Error(`No encuentro la escena «${nombre}»`)
}
