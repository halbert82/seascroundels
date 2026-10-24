// Escenas fijas de la mesa para las capturas y para enseñar la mesa en un momento concreto:
// se juega una partida con el jugador automático y una semilla fija hasta llegar al momento buscado.

import { responder } from '../../engine/motor.ts'
import { nuevaPartida } from '../../engine/preparacion.ts'
import { jugadorConCriterio } from '../../engine/pruebas/jugadores.ts'
import { Jugador } from '../../engine/pruebas/situacion.ts'
import type { Estado, InstId } from '../../engine/tipos.ts'
import { empezar, type PartidaEnMesa } from './usePartida.ts'

export const ESCENAS = [
  'puerto',
  'prueba',
  'finMision',
  'enJuego',
  'muelleOcupado',
  'alarma',
  'finalMision',
  'mano5',
  'mano8',
  'permanentes',
  'capituloNuevo',
  'dosDestinos',
  'tripulacionDePaso',
  'aPorEllos',
  'aPorEllosOfrecida',
  'protegido',
  'rival',
  'bucear',
  'asedio',
] as const
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

const CONDICION: Record<
  Exclude<
    Escena,
    | 'enJuego'
    | 'muelleOcupado'
    | 'alarma'
    | 'finalMision'
    | 'mano5'
    | 'mano8'
    | 'permanentes'
    | 'capituloNuevo'
    | 'dosDestinos'
    | 'tripulacionDePaso'
    | 'aPorEllos'
    | 'aPorEllosOfrecida'
    | 'protegido'
    | 'rival'
    | 'bucear'
    | 'asedio'
  >,
  (s: Estado, desde: number) => boolean
> = {
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
 * Fase 13, en Naturaleza: «Bruma en la selva» resuelve 2 cartas de Destino. Salen los de «La corriente del Golfo» (+1)
 * y «Calma chicha» (−1), y los dos se ven a la vez en el panel de la Prueba.
 */
function dosDestinos(): PartidaEnMesa {
  const j = Jugador.enMision({
    misiones: ['pruebas-nat3'],
    mazoPeligros: ['p2_niebla', 'p2_corriente', 'p2_calma', 'chubasco', 'calma'],
    mazoCapitan: [...MAZO],
    mano: ['ojo', 'timon', 'coraje', 'reflejos'],
    tripulacion: ['baqueano', 'bucanero'],
    reputacion: 3,
  })
  j.comprometer('EXP', ['capitan', 'baqueano']).pasarOfertas()
  return { ...empezar(j.estado), desde: Math.max(0, j.estado.registro.length - 6) }
}

/**
 * Fase 14, en puerto: dos Enrolados con sus fichas (al Piloto le queda 1: se va al final de este turno), la Carne de
 * cañón herida y El Tuerto con 2 heridas (COM 3); en el muelle, la Guía de alquiler y el Galeote fugado.
 */
function tripulacionDePaso(): PartidaEnMesa {
  const j = Jugador.en({
    mazoCapitan: [...MAZO],
    mano: ['ojo', 'timon', 'coraje', 'abordaje', 'vendas'],
    tripulacion: [{ id: 'piloto_sueldo', enrolado: 1 }, { id: 'soldado_fortuna', enrolado: 2 }, { id: 'carne_canon', heridas: 1 }, { id: 'tuerto', heridas: 2 }],
    muelle: ['guia_alquiler', 'galeote', 'vela', 'sable'],
    reputacion: 4,
  })
  return { ...empezar(j.estado), desde: j.estado.registro.length }
}

/**
 * Fase 14, en Ciudad: «Leva forzosa» fallada va a descartar a la Vigía inexperta. `ofrecida`: se ofrece «¡A por ellos!»
 * (Interrupción). Si no, ya jugada: su Prueba de COM 3 con el Bucanero veterano asignado y su Destino revelado, mientras
 * la de la leva (y su Destino) espera en la mesa.
 */
function aPorEllos(ofrecida: boolean): PartidaEnMesa {
  const j = Jugador.enMision({
    misiones: ['pruebas-ciu4'],
    mazoPeligros: ['p2_grilletes', 'chubasco', 'calma', 'calma', 'calma'],
    mazoCapitan: [...MAZO],
    mano: ['a_por_ellos', 'ojo', 'timon'],
    tripulacion: ['vigia', 'bucanero', 'matasanos'],
    reputacion: 3,
  })
  j.comprometer('COM', ['vigia', 'matasanos']).seguir()
  if (!ofrecida) j.usar('a_por_ellos.jugar').elegir('ojo').comprometer('COM', ['bucanero']).pasarOfertas()
  return { ...empezar(j.estado), desde: Math.max(0, j.estado.registro.length - 8) }
}

/**
 * Fase 15, «Escolta del San Telmo»: el galeón ya ha sufrido 1 daño; «Piratas rivales» se falla y el Barco va a sufrir 1
 * daño: se ofrece que lo sufra el galeón en su lugar (Interrupción).
 */
function protegido(): PartidaEnMesa {
  const j = Jugador.en({
    empezarEn: 'quedarseOZarpar',
    escenario: ['pruebas-calma', 'pruebas-calma', 'pruebas-calma'],
    misiones: ['escolta-I', 'prueba-I', 'aguada-I'],
    mazoPeligros: ['calma', 'rivales', 'chubasco', 'calma', 'calma'],
    mazoCapitan: [...MAZO],
    mano: ['ojo', 'timon', 'coraje'],
    tripulacion: ['bucanero', 'vigia'],
    barco: { mejoras: ['vela'] },
    reputacion: 4,
  })
  j.zarpar('escolta-I').seguir()
  j.copia('pm_galeon').heridas = 1
  j.comprometer('COM', []).seguir()
  return { ...empezar(j.estado), desde: Math.max(0, j.estado.registro.length - 8) }
}

/** Fase 15, «La regata de San Juan»: dos Peligros revelados (4 de Rival) y la Prueba de NAV del tercero, a medias. */
function rival(): PartidaEnMesa {
  const j = Jugador.en({
    empezarEn: 'quedarseOZarpar',
    escenario: ['pruebas-calma', 'pruebas-calma', 'pruebas-calma'],
    misiones: ['regata-I', 'prueba-I', 'aguada-I'],
    mazoPeligros: ['calma', 'chubasco', 'calma', 'oportunidad', 'calma', 'calma'],
    mazoCapitan: [...MAZO],
    mano: ['ojo', 'timon', 'coraje'],
    tripulacion: ['viejo_lobo', 'bucanero'],
    reputacion: 4,
  })
  j.zarpar('regata-I').seguir()
  j.comprometer('NAV', ['bucanero']).pasarOfertas().seguir()
  if (j.decision.tipo === 'elegirCartas') j.elegir('bucanero')
  j.seguir().comprometer('NAV', ['viejo_lobo']).pasarOfertas()
  return { ...empezar(j.estado), desde: Math.max(0, j.estado.registro.length - 10) }
}

/**
 * Fase 15, «El naufragio del San José»: superada la misión, coges la carta 286 y buceas dos veces: «El cofre del virrey» (te
 * lo quedas, a un lado) y «El pulpo de la bodega», que atrapa a la Guía: ¿lo saca otro entre dos o se suelta solo?
 */
function bucear(): PartidaEnMesa {
  const j = Jugador.en({
    empezarEn: 'quedarseOZarpar',
    escenario: ['pruebas-calma', 'pruebas-calma', 'pruebas-calma'],
    misiones: ['naufragio-I', 'prueba-I', 'aguada-I'],
    mazoPeligros: ['calma', 'calma', 'chubasco', 'chubasco', 'chubasco', 'chubasco'],
    mazoCapitan: [...MAZO],
    mano: ['ojo', 'timon', 'coraje'],
    tripulacion: ['vigia', 'guia_alquiler', 'baqueano'],
    reputacion: 4,
  })
  j.zarpar('naufragio-I').seguir()
  j.encimaDelNaufragio('naufragio_cofre', 'naufragio_pulpo').opcion('bucear').elegir('vigia')
  j.opcion('bucear').elegir('guia_alquiler')
  // Fase 15 (tercera ronda): la misión se supera antes de bucear (el buceo es su recompensa, la carta 286); el panel de
  // «Misión superada» ya se ha cerrado.
  const superada = j.estado.registro.findIndex((r) => r.dato?.tipo === 'finMision')
  return { ...empezar(j.estado), desde: Math.max(superada + 1, j.estado.registro.length - 10) }
}

/**
 * Fase 15, en puerto: «El asedio de Port Royal» está disponible y sus Murallas, en juego, han sufrido 2 daños; «Mala
 * fama» sigue en juego de una misión anterior (los Tripulantes cuestan 1 carta más).
 */
function asedio(): PartidaEnMesa {
  const j = Jugador.en({
    mazoCapitan: [...MAZO],
    escenario: ['pruebas-calma', 'pruebas-calma', 'pruebas-calma', 'pruebas-calma'],
    mano: ['ojo', 'timon', 'coraje', 'abordaje'],
    misiones: ['asedio-I', 'prueba-I', 'aguada-I'],
    tripulacion: ['bucanero', 'vigia'],
    muelle: ['contrabandista', 'galeote', 'vela', 'matasanos'],
    permanentes: ['pm_malafama'],
    reputacion: 4,
  })
  j.copia('pm_murallas').heridas = 2
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
  if (nombre === 'dosDestinos') return dosDestinos()
  if (nombre === 'tripulacionDePaso') return tripulacionDePaso()
  if (nombre === 'aPorEllos') return aPorEllos(false)
  if (nombre === 'aPorEllosOfrecida') return aPorEllos(true)
  if (nombre === 'protegido') return protegido()
  if (nombre === 'rival') return rival()
  if (nombre === 'bucear') return bucear()
  if (nombre === 'asedio') return asedio()
  for (let semilla = 1; semilla < 60; semilla++) {
    const p = buscar(semilla, CONDICION[nombre as keyof typeof CONDICION])
    if (p) return p
  }
  throw new Error(`No encuentro la escena «${nombre}»`)
}
