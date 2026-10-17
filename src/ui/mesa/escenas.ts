// Escenas fijas de la mesa para las capturas y para enseñar la mesa en un momento concreto:
// se juega una partida con el jugador automático y una semilla fija hasta llegar al momento buscado.

import { responder } from '../../engine/motor.ts'
import { nuevaPartida } from '../../engine/preparacion.ts'
import { jugadorConCriterio } from '../../engine/pruebas/jugadores.ts'
import { Jugador } from '../../engine/pruebas/situacion.ts'
import type { Estado, InstId } from '../../engine/tipos.ts'
import { empezar, type PartidaEnMesa } from './usePartida.ts'

export const ESCENAS = ['puerto', 'prueba', 'finMision', 'enJuego', 'muelleOcupado'] as const
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

const CONDICION: Record<Exclude<Escena, 'enJuego' | 'muelleOcupado'>, (s: Estado, desde: number) => boolean> = {
  // En puerto, en Jugar cartas, con algo de partida ya jugada.
  puerto: (s) => s.turno >= 3 && s.pendiente?.motivo.clave === 'jugarCartas' && s.zonas.tripulacion.length >= 3,
  // Una Prueba con comprometidos y el Destino revelado, en la ventana de acción.
  prueba: (s) =>
    s.turno >= 2 && s.pendiente?.motivo.clave === 'ventanaPrueba' && (s.prueba?.comprometidos.length ?? 0) >= 2 && s.zonas.mano.length >= 2,
  // Justo después de superar una misión.
  finMision: (s, desde) => s.turno >= 2 && s.registro.slice(desde).some((r) => r.dato?.tipo === 'finMision' && r.dato.resultado === 'superada'),
}

const MAZO = ['ojo', 'ojo', 'timon', 'timon', 'coraje', 'coraje', 'emboscada', 'estrellas', 'abordaje', 'vendas']

/**
 * Fase 6, en una misión de Mar: «Bajamar» en juego con 1 ficha, Estados en Tripulantes y Barco, una carta incautada
 * y la Prueba de «Niebla» con el Destino revelado.
 */
function enJuego(): PartidaEnMesa {
  const j = Jugador.enMision({
    misiones: ['maracaibo-II'],
    mazoPeligros: ['p2_bajamar', 'p2_niebla', 'chubasco', 'p2_cielo', 'calma'],
    mazoCapitan: [...MAZO],
    mano: ['ojo', 'timon', 'coraje', 'abordaje', 'cataplasma'],
    tripulacion: [{ id: 'bucanero', estados: ['envenenado', 'inspirado'] }, { id: 'marinero_p' }, { id: 'vigia', estados: ['buscado'] }, 'practico'],
    barco: { estados: ['viaDeAgua', 'velasRotas'], mejoras: [{ id: 'bronce', municion: 1 }, 'vela'] },
    reputacion: 6,
  })
  // Una carta de la mano, incautada bajo la misión.
  const s = j.estado
  const incautada = s.zonas.mano.find((c) => s.cartas[c]?.id === 'abordaje') as InstId
  s.zonas.mano = s.zonas.mano.filter((c) => c !== incautada)
  s.zonas.incautadas.push(incautada)
  s.incautadas = { [incautada]: { zona: 'mano' } }
  j.seguir()
  j.comprometer('COM', ['bucanero', 'capitan']).pasarOfertas()
  return { ...empezar(j.estado), desde: Math.max(0, j.estado.registro.length - 6) }
}

/** Fase 6, en puerto: el pecio del «Huracán» ocupa el muelle y se libera a un Encadenado con una Prueba. */
function muelleOcupado(): PartidaEnMesa {
  const j = Jugador.enMision({
    misiones: ['ladron-I'],
    mazoPeligros: ['p2_huracan', 'chubasco', 'calma', 'calma', 'calma'],
    mazoCapitan: [...MAZO, ...MAZO],
    escenario: ['rumores', 'rumores', 'rumores'],
    muelle: ['marinero_p', 'reinaldo', 'bucanero', 'vigia'],
    mazoMuelle: ['carpintero', 'matasanos', 'grumete', 'saqueador', 'canonero', 'vela', 'hamacas'],
    tripulacion: [{ id: 'carpintero', estados: ['encadenado'] }, { id: 'bucanero', estados: ['fiebre'] }],
  })
  j.comprometer('NAV', []).seguir().retirarse().opcion('dejar')
  while (j.estado.pendiente && j.decision.motivo.clave !== 'jugarCartas') {
    const d = j.decision
    if (d.tipo === 'elegirCartas') j.responder({ tipo: 'cartas', ids: d.candidatas.slice(0, d.min) })
    else if (d.tipo === 'elegirOpcion') j.opcion(d.opciones.find((o) => o.clave === 'quedarse')?.clave ?? d.opciones[0]?.clave ?? '')
    else if (d.tipo === 'ofrecer') j.pasar()
    else if (d.tipo === 'repartir') j.responder({ tipo: 'reparto', n: {} })
    else j.terminar()
  }
  j.usar('estado:encadenado.liberar').comprometer('COM', ['bucanero']).pasarOfertas()
  return { ...empezar(j.estado), desde: Math.max(0, j.estado.registro.length - 6) }
}

export function escena(nombre: Escena): PartidaEnMesa {
  if (nombre === 'enJuego') return enJuego()
  if (nombre === 'muelleOcupado') return muelleOcupado()
  for (let semilla = 1; semilla < 60; semilla++) {
    const p = buscar(semilla, CONDICION[nombre as keyof typeof CONDICION])
    if (p) return p
  }
  throw new Error(`No encuentro la escena «${nombre}»`)
}
