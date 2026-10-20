// Escenas fijas de la mesa para las capturas y para enseñar la mesa en un momento concreto:
// se juega una partida con el jugador automático y una semilla fija hasta llegar al momento buscado.

import { responder } from '../../engine/motor.ts'
import { nuevaPartida } from '../../engine/preparacion.ts'
import { jugadorConCriterio } from '../../engine/pruebas/jugadores.ts'
import { Jugador } from '../../engine/pruebas/situacion.ts'
import type { Estado, InstId } from '../../engine/tipos.ts'
import { empezar, type PartidaEnMesa } from './usePartida.ts'

export const ESCENAS = ['puerto', 'prueba', 'finMision', 'enJuego', 'muelleOcupado', 'alarma', 'finalMision', 'mano5', 'mano8', 'permanentes', 'capituloNuevo'] as const
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

const CONDICION: Record<Exclude<Escena, 'enJuego' | 'muelleOcupado' | 'alarma' | 'finalMision' | 'mano5' | 'mano8' | 'permanentes' | 'capituloNuevo'>, (s: Estado, desde: number) => boolean> = {
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
 * Fase 6, en una misión de Mar: «Bajamar» en juego con 1 ficha, Estados y Ventajas en Tripulantes, Estados en el Barco, una carta incautada
 * y la Prueba de «Niebla» con el Destino revelado.
 */
function enJuego(): PartidaEnMesa {
  const j = Jugador.enMision({
    misiones: ['pruebas-mar5'],
    mazoPeligros: ['p2_bajamar', 'p2_niebla', 'chubasco', 'p2_cielo', 'calma'],
    mazoCapitan: [...MAZO],
    mano: ['ojo', 'timon', 'coraje', 'abordaje', 'cataplasma'],
    tripulacion: [{ id: 'bucanero', estados: ['envenenado', 'inspirado'] }, { id: 'marinero_p' }, { id: 'vigia', estados: ['buscado'] }, { id: 'practico', estados: ['aguerrido'] }],
    // Sin Vía de agua: desde la fase 10b, al final de cada Peligro pregunta si achicas, y la escena se pararía ahí.
    barco: { estados: ['perseguido', 'velasRotas'], mejoras: [{ id: 'bronce', agotada: true }, 'vela'] },
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

/**
 * Fase 11, en Ciudad: cinco permanentes en la zona de permanentes. «Campanas a rebato» y «No vuelven de la taberna» salen
 * de sus Peligros; «¡La guardia!», «Murmullos en el sollado» y «Arenas movedizas» (junto a la Vigía, atrapada) se ponen a
 * mano, para ver la zona llena. Después, la Prueba de «Sangre caliente» con el Destino revelado.
 */
function permanentes(): PartidaEnMesa {
  const j = Jugador.enMision({
    misiones: ['pruebas-ciu9'],
    mazoPeligros: ['p2_rebato', 'p2_motin', 'p2_sangre', 'chubasco', 'calma', 'calma'],
    mazoCapitan: [...MAZO],
    mano: ['ojo', 'timon', 'coraje', 'abordaje'],
    tripulacion: ['vigia', 'bucanero', 'baqueano', 'reinaldo'],
    barco: { mejoras: ['vela'] },
    reputacion: 4,
  })
  j.seguir()
  const s = j.estado
  const poner = (id: string, fichas?: number, junto?: string): InstId => {
    const c = s.zonas.mazoHistoria.find((x) => s.cartas[x]?.id === id) as InstId
    s.zonas.mazoHistoria = s.zonas.mazoHistoria.filter((x) => x !== c)
    s.zonas.permanentes.push(c)
    const copia = s.cartas[c]
    if (copia && fichas !== undefined) copia.fichas = fichas
    if (copia && junto) copia.junto = j.inst(junto)
    return c
  }
  poner('guardia')
  poner('pm_murmullos', 1)
  const arenas = poner('pm_arenas', 1, 'vigia')
  s.temporales.push(
    { clave: 'noCompromete', fuente: 'pm_arenas', hasta: 'carta', inst: j.inst('vigia'), carta: arenas },
    { clave: 'noPrepara', fuente: 'pm_arenas', hasta: 'carta', inst: j.inst('vigia'), carta: arenas },
  )
  j.seguir()
  // Las fichas que ponen a la vez las campanas y los murmullos: el orden da igual.
  while (j.decision.motivo.clave === 'ordenObligadas' && j.decision.tipo === 'elegirOpcion') j.opcion(j.decision.opciones[0]?.clave ?? '')
  j.comprometer('COM', ['capitan', 'reinaldo']).pasarOfertas()
  return { ...empezar(j.estado), desde: Math.max(0, j.estado.registro.length - 8) }
}

/** Fase 6, en puerto: el pecio del «Huracán» ocupa el muelle (Encadenado ya no existe desde la fase 10b). */
function muelleOcupado(): PartidaEnMesa {
  const j = Jugador.enMision({
    misiones: ['ladron-I'],
    mazoPeligros: ['p2_huracan', 'chubasco', 'calma', 'calma', 'calma'],
    mazoCapitan: [...MAZO, ...MAZO],
    escenario: ['rumores', 'rumores', 'rumores'],
    muelle: ['marinero_p', 'reinaldo', 'bucanero', 'vigia'],
    mazoMuelle: ['carpintero', 'matasanos', 'grumete', 'saqueador', 'canonero', 'vela', 'hamacas'],
    tripulacion: [{ id: 'carpintero', estados: ['buscado'] }, { id: 'bucanero', estados: ['sangrando'] }],
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
  return { ...empezar(j.estado), desde: Math.max(0, j.estado.registro.length - 6) }
}

/**
 * Fase 7, «La casa del gobernador»: tres Pruebas de COM superadas ponen la Alarma a 3 y llega «¡La guardia!». Don
 * Anselmo viaja como Pasajero.
 */
function alarma(): PartidaEnMesa {
  const j = Jugador.enMision({
    misiones: ['gobernador-I'],
    mazoPeligros: Array.from({ length: 9 }, () => 'oportunidad'),
    mazoCapitan: [...MAZO],
    mano: ['ojo', 'timon', 'abordaje'],
    tripulacion: ['reinaldo', 'filibustero', 'espadachin'],
    pasajeros: ['anselmo'],
    reputacion: 5,
  })
  j.comprometer('COM', ['filibustero']).seguir().seguir().comprometer('COM', ['espadachin']).seguir().seguir()
  j.comprometer('COM', ['reinaldo']).seguir()
  return { ...empezar(j.estado), desde: Math.max(0, j.estado.registro.length - 6) }
}

/** Fase 7, «El templo» superado: final con elección (la Espada del sacerdote o devolver el ídolo). */
function finalMision(): PartidaEnMesa {
  const j = Jugador.enMision({
    misiones: ['templo-IV'],
    avance: { 'templo-IV': 3 },
    mazoHistoria: ['espada'],
    mazoPeligros: Array.from({ length: 7 }, () => 'calma'),
    mazoCapitan: [...MAZO],
    mano: ['ojo', 'timon'],
    tripulacion: ['viejo_lobo', 'baqueano'],
    reputacion: 5,
  })
  const desde = j.estado.registro.findIndex((r) => r.dato?.tipo === 'zarpar')
  return { ...empezar(j.estado), desde: Math.max(0, desde) }
}

/**
 * Fase 12: recién superado «El Paso de los Vientos» (Flota I), «El galeón rezagado» (Flota II) se ha puesto encima del
 * mazo de Misiones y acaba de salir entre las disponibles, con su marca de capítulo nuevo.
 */
function capituloNuevo(): PartidaEnMesa {
  const j = Jugador.en({
    empezarEn: 'quedarseOZarpar',
    escenario: ['pruebas-calma', 'pruebas-calma', 'pruebas-calma'],
    misiones: ['flota-I', 'prueba-I', 'aguada-I'],
    mazoMisiones: ['fantasma-I', 'templo-I', 'espia-I'],
    avance: { 'flota-I': 4 },
    mazoPeligros: ['calma', 'calma', 'calma'],
    mazoCapitan: [...MAZO],
    mano: ['ojo', 'timon', 'coraje'],
    tripulacion: ['viejo_lobo', 'bucanero'],
    reputacion: 3,
  })
  j.zarpar('flota-I')
  // Sin agotar a nadie al zarpar; un «Mar en calma» y vuelve a puerto con la misión superada.
  for (let n = 0; n < 20 && j.estado.mision; n++) {
    const d = j.decision
    if (d.motivo.clave === 'alZarparAgotar') j.ninguna()
    else if (d.tipo === 'ofrecer') j.pasar()
    else j.seguir()
  }
  return { ...empezar(j.estado), desde: j.estado.registro.length }
}

/**
 * En puerto, en Jugar cartas, con la mano llena: 5 cartas (el Mando del Capitán) o, robando 3 más del mazo del capitán,
 * 8 (una mano muy llena). Para ver que la mano se ve entera en una tableta.
 */
function manoDe(n: 5 | 8): PartidaEnMesa {
  for (let semilla = 1; semilla < 60; semilla++) {
    const p = buscar(semilla, (s) => s.turno >= 3 && s.pendiente?.motivo.clave === 'jugarCartas' && s.zonas.mano.length === 5 && s.zonas.tripulacion.length >= 3)
    if (!p) continue
    const s = p.estado
    s.zonas.mano.push(...s.zonas.mazoCapitan.splice(0, n - 5))
    return { ...empezar(s), desde: p.desde }
  }
  throw new Error(`No encuentro una mano de ${n} cartas`)
}

export function escena(nombre: Escena): PartidaEnMesa {
  if (nombre === 'mano5') return manoDe(5)
  if (nombre === 'mano8') return manoDe(8)
  if (nombre === 'enJuego') return enJuego()
  if (nombre === 'permanentes') return permanentes()
  if (nombre === 'muelleOcupado') return muelleOcupado()
  if (nombre === 'alarma') return alarma()
  if (nombre === 'finalMision') return finalMision()
  if (nombre === 'capituloNuevo') return capituloNuevo()
  for (let semilla = 1; semilla < 60; semilla++) {
    const p = buscar(semilla, CONDICION[nombre as keyof typeof CONDICION])
    if (p) return p
  }
  throw new Error(`No encuentro la escena «${nombre}»`)
}
