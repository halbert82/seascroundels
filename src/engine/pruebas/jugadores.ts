// Jugadores automáticos para las pruebas masivas y el informe de equilibrio:
// - al azar: cualquier jugada legal;
// - con criterio: reglas sencillas de un jugador prudente (no es un jugador experto).

import { aleatorio, barajarLista, entero, sembrar } from '../azar.ts'
import { costeImpreso, iconosDe, porId } from '../catalogo.ts'
import { DATOS } from '../datos.ts'
import { interpretarEfectos } from '../efectos.ts'
import { copia } from '../estado.ts'
import { encuentroDe } from '../peligros.ts'
import { dificultadPrueba, prevision, totalPrueba } from '../prueba.ts'
import type { Accion, Decision, Eleccion, Estado, InstId } from '../tipos.ts'
import { navParaDistancia, valor } from '../valores.ts'

export type JugadorAutomatico = (s: Estado, d: Decision) => Eleccion

// ---------------------------------------------------------------------------
// Al azar

export function jugadorAlAzar(semilla: number | string): JugadorAutomatico {
  const azar = { azar: sembrar(`azar-${semilla}`) }
  return (_s, d) => {
    if (d.libres && d.libres.length > 0 && aleatorio(azar) < 0.2) return { tipo: 'usar', uso: d.libres[entero(azar, d.libres.length)]! }
    switch (d.tipo) {
      case 'ventanaAccion': {
        const terminar = d.acciones.find((a) => a.tipo === 'terminarPaso')
        if (terminar && aleatorio(azar) < 0.35) return { tipo: 'accion', accion: terminar }
        return { tipo: 'accion', accion: d.acciones[entero(azar, d.acciones.length)]! }
      }
      case 'elegirCartas': {
        const n = d.min + entero(azar, d.max - d.min + 1)
        const ids = [...d.candidatas]
        barajarLista(azar, ids)
        return { tipo: 'cartas', ids: ids.slice(0, n) }
      }
      case 'elegirOpcion':
        return { tipo: 'opcion', clave: d.opciones[entero(azar, d.opciones.length)]!.clave }
      case 'ofrecer':
        return aleatorio(azar) < 0.5 || d.usos.length === 0 ? { tipo: 'pasar' } : { tipo: 'usar', uso: d.usos[0]! }
      case 'repartir':
        return { tipo: 'reparto', n: repartoAlAzar(azar, d.cantidad, d.maximos) }
      case 'cubrirDistancia':
        // Todos los preparados y todas las cartas: siempre llega (el motor solo ofrece misiones alcanzables).
        return { tipo: 'cartas', ids: [...d.tripulantes, ...d.cartas] }
      case 'comprometer': {
        const opcion = entero(azar, d.opciones.length)
        const hab = d.opciones[opcion]!.hab
        const tripulantes = d.tripulantes.filter(() => aleatorio(azar) < 0.6)
        const cartas = tripulantes.length > 0 ? d.cartas.filter((c) => iconos(_s, c, hab) > 0 && aleatorio(azar) < 0.3) : []
        return { tipo: 'compromiso', opcion, tripulantes, cartas }
      }
    }
  }
}

function repartoAlAzar(azar: { azar: [number, number, number, number] }, cantidad: number, maximos: Partial<Record<InstId, number>>) {
  const n: Partial<Record<InstId, number>> = {}
  let resto = cantidad
  const destinos = Object.keys(maximos) as InstId[]
  barajarLista(azar, destinos)
  for (const inst of destinos) {
    const poner = Math.min(resto, maximos[inst] ?? 0)
    n[inst] = poner
    resto -= poner
  }
  return n
}

// ---------------------------------------------------------------------------
// Con criterio

function iconos(s: Estado, carta: InstId, hab: 'NAV' | 'COM' | 'EXP'): number {
  return iconosDe(copia(s, carta).id, hab)
}

function iconosTotales(s: Estado, carta: InstId): number {
  return iconos(s, carta, 'NAV') + iconos(s, carta, 'COM') + iconos(s, carta, 'EXP')
}

function vidaRestante(s: Estado, c: InstId): number {
  return valor(s, { tipo: 'vida', carta: c }) - copia(s, c).heridas
}

/** Valor de un Tripulante en juego: sus habilidades (el Capitán vale mucho más: si cae, se pierde). */
function valorTripulante(s: Estado, c: InstId): number {
  if (c === s.capitan) return 100
  const e = porId(copia(s, c).id)
  return e.tipo === 'tripulante' ? e.carta.NAV + e.carta.COM + e.carta.EXP + e.carta.vida * 0.5 : 0
}

function puntuacionTripulanteEnMuelle(id: string): number {
  const e = porId(id)
  return e.tipo === 'tripulante' ? e.carta.NAV + e.carta.COM + e.carta.EXP + e.carta.vida * 0.4 - e.carta.coste * 0.6 : -99
}

const MEJORAS_PREFERIDAS: Record<string, number> = {
  vela: 5,
  chalupa: 4,
  hamacas: 3,
  casco: 3,
  sable: 3,
  brujula: 3,
  catalejo: 3,
  bronce: 2,
  botica: 1,
}

/** Lo que vale para el jugador la victoria de «Las puertas de Panamá», en puntos de reputación. */
const VALOR_VICTORIA = 12
/** Cuánto pesa lo que queda de una cadena (ajustado jugando: más peso le hace jugar San Felipe y pierde más). */
const PESO_CADENA = 0.2

/** Puntuación de una misión disponible para zarpar o para poner Avance. */
function puntuacionMision(s: Estado, m: InstId): number {
  const e = porId(copia(s, m).id)
  if (e.tipo !== 'capitulo') return -99
  const falta = Math.max(0, valor(s, { tipo: 'avanceNecesario', mision: m }) - copia(s, m).avance)
  const rep = e.carta.recompensa.rep ?? 0
  const victoria = e.carta.recompensa.victoria ? 30 : 0
  // Lo que vale el resto de la cadena, si quedan turnos para terminarla (cada capítulo hay que sacarlo del mazo de Misiones y jugarlo).
  const posteriores = e.mision.capitulos.slice(e.mision.capitulos.indexOf(e.carta) + 1)
  const futuro = posteriores.reduce((n, c) => n + (c.recompensa.victoria ? VALOR_VICTORIA : (c.recompensa.rep ?? 0)), 0)
  const holgura = s.zonas.mazoEscenario.length - 2 * posteriores.length
  const cadena = futuro * Math.min(PESO_CADENA, Math.max(0, holgura / 10)) * 2.2
  const distancia = valor(s, { tipo: 'distancia', mision: m })
  const enMar = e.carta.entorno === 'mar' ? 0.5 : 0
  return rep * 2.2 + victoria + cadena - falta * 0.9 - distancia * 0.6 + enMar
}

function peligroDeFallo(s: Estado, carta: InstId): number {
  const efectos = interpretarEfectos(encuentroDe(s, carta).textoFallo ?? '')
  let peligro = 0
  for (const e of efectos) {
    if (e.tipo === 'heridas') peligro += e.n * 1.5
    else if (e.tipo === 'dano') peligro += e.n * 1.2
    else if (e.tipo === 'rehen') peligro += 3
    else if (e.tipo === 'perderAvance') peligro += e.n === 'todo' ? 3 : e.n
    else peligro += 0.5
  }
  return peligro
}

/** Mejor compromiso: el grupo más barato que llega a la dificultad con margen, o nadie si no compensa. */
function elegirCompromiso(s: Estado, d: Extract<Decision, { tipo: 'comprometer' }>): Eleccion {
  const p = s.prueba
  const encuentro = p?.encuentro
  if (!encuentro) return { tipo: 'compromiso', opcion: 0, tripulantes: [], cartas: [] }
  const tripulantes = d.tripulantes
  let mejor: { coste: number; eleccion: Eleccion } | null = null
  for (let opcion = 0; opcion < d.opciones.length; opcion++) {
    const hab = d.opciones[opcion]!.hab
    const cartas = d.cartas.filter((c) => iconos(s, c, hab) > 0).sort((a, b) => iconos(s, b, hab) - iconos(s, a, hab))
    for (let mascara = 1; mascara < 1 << tripulantes.length; mascara++) {
      const grupo = tripulantes.filter((_, i) => mascara & (1 << i))
      const sinCartas = prevision(s, encuentro, opcion, grupo, [])
      const objetivo = sinCartas.dificultad + 1 // margen para el Destino
      let total = sinCartas.total
      const usadas: InstId[] = []
      for (const c of cartas) {
        if (total >= objetivo) break
        usadas.push(c)
        total += iconos(s, c, hab)
      }
      if (total < sinCartas.dificultad) continue
      const coste =
        grupo.reduce((n, c) => n + (c === s.capitan ? 2.5 : 1 + valorTripulante(s, c) / 8), 0) + usadas.length * 0.8 - (total >= objetivo ? 0.5 : 0)
      if (!mejor || coste < mejor.coste) mejor = { coste, eleccion: { tipo: 'compromiso', opcion, tripulantes: grupo, cartas: usadas } }
    }
  }
  if (mejor) return mejor.eleccion
  // No llega: si el fallo es suave, no compromete a nadie; si duele, lo intenta con todo.
  if (peligroDeFallo(s, encuentro) < 2) return { tipo: 'compromiso', opcion: 0, tripulantes: [], cartas: [] }
  const hab = d.opciones[0]!.hab
  return { tipo: 'compromiso', opcion: 0, tripulantes: [...tripulantes], cartas: tripulantes.length > 0 ? d.cartas.filter((c) => iconos(s, c, hab) > 0) : [] }
}

function elegirCartas(s: Estado, d: Extract<Decision, { tipo: 'elegirCartas' }>): Eleccion {
  const n = d.min
  const por = (f: (c: InstId) => number) => [...d.candidatas].sort((a, b) => f(a) - f(b))
  switch (d.motivo.clave) {
    case 'cambiarMano':
    case 'descartarFinal':
      return { tipo: 'cartas', ids: [] }
    case 'pagar':
    case 'descartar':
      return { tipo: 'cartas', ids: por((c) => iconosTotales(s, c)).slice(0, n) }
    case 'herir':
      // Al que más vida le queda, sin el Capitán si se puede.
      return { tipo: 'cartas', ids: por((c) => (c === s.capitan ? 50 : 0) - vidaRestante(s, c)).slice(0, 1) }
    case 'agotar':
    case 'exceso':
    case 'desercion':
    case 'rehen':
      return { tipo: 'cartas', ids: por((c) => valorTripulante(s, c)).slice(0, n) }
    case 'perderMejora':
    case 'agotarMejora':
      return { tipo: 'cartas', ids: por((c) => costeImpreso(copia(s, c).id)).slice(0, n) }
    case 'buscar':
      return { tipo: 'cartas', ids: por((c) => -puntuacionTripulanteEnMuelle(copia(s, c).id) - (MEJORAS_PREFERIDAS[copia(s, c).id] ?? 0)).slice(0, 1) }
    case 'soplos':
      return { tipo: 'cartas', ids: por((c) => -puntuacionMision(s, c)).slice(0, 1) }
    case 'tablon': {
      const malas = d.candidatas.filter((m) => puntuacionMision(s, m) < 0)
      return { tipo: 'cartas', ids: malas.slice(0, d.max) }
    }
    case 'alZarparAgotar': {
      const otros = d.candidatas.filter((c) => c !== s.capitan)
      return { tipo: 'cartas', ids: otros.slice(0, 1) }
    }
    case 'reclutaEncuentro': {
      const mejor = por((c) => -puntuacionTripulanteEnMuelle(copia(s, c).id))[0]
      return { tipo: 'cartas', ids: mejor && s.zonas.mano.length > costeImpreso(copia(s, mejor).id) ? [mejor] : [] }
    }
    case 'reasignarTesoro':
    case 'portadorTesoro':
    case 'preparar':
      return { tipo: 'cartas', ids: por((c) => -valorTripulante(s, c)).slice(0, 1) }
    default:
      return { tipo: 'cartas', ids: d.candidatas.slice(0, n) }
  }
}

function elegirEnJugarCartas(s: Estado, acciones: readonly Accion[]): Eleccion {
  const mano = s.zonas.mano.length
  let mejor: { puntos: number; accion: Accion } | null = null
  for (const a of acciones) {
    let puntos = -1
    if (a.tipo === 'reclutar') {
      const id = copia(s, a.carta).id
      if (mano - valor(s, { tipo: 'coste', carta: a.carta }) >= 2) puntos = 3 + puntuacionTripulanteEnMuelle(id)
    } else if (a.tipo === 'adquirir') {
      const id = copia(s, a.carta).id
      const base = MEJORAS_PREFERIDAS[id] ?? -1
      const portadorBueno = a.destino === 'barco' || a.destino === s.capitan || valorTripulante(s, a.destino) >= 4
      if (base > 0 && portadorBueno && mano - valor(s, { tipo: 'coste', carta: a.carta }) >= 2) puntos = base
    }
    if (puntos > 0 && (!mejor || puntos > mejor.puntos)) mejor = { puntos, accion: a }
  }
  return { tipo: 'accion', accion: mejor?.accion ?? { tipo: 'terminarPaso' } }
}

function elegirOpcion(s: Estado, d: Extract<Decision, { tipo: 'elegirOpcion' }>): Eleccion {
  const claves = d.opciones.map((o) => o.clave)
  const elegir = (clave: string) => ({ tipo: 'opcion' as const, clave })
  switch (d.motivo.clave) {
    case 'quedarseOZarpar': {
      const capitan = copia(s, s.capitan)
      const enPeligro = vidaRestante(s, s.capitan) <= 1 || s.danoBarco >= valor(s, { tipo: 'danoMaximo' }) - 1
      const tarde = s.ultimoTurno || s.zonas.mazoEscenario.length <= 1
      let mejor: { puntos: number; clave: string } | null = null
      for (const clave of claves.filter((c) => c.startsWith('zarpar:'))) {
        const puntos = puntuacionMision(s, clave.slice(7) as InstId)
        if (!mejor || puntos > mejor.puntos) mejor = { puntos, clave }
      }
      if (mejor && (tarde || (!enPeligro && mejor.puntos > -1.5) || (capitan.heridas === 0 && mejor.puntos > -3))) return elegir(mejor.clave)
      return elegir('quedarse')
    }
    case 'opcionPuerto': {
      const heridas = s.zonas.tripulacion.reduce((n, c) => n + copia(s, c).heridas, 0)
      const preferidas = [heridas > 0 ? 'taberna' : '', s.danoBarco > 0 ? 'astillero' : '', 'propia', 'tablon', 'taberna', 'astillero']
      return elegir(preferidas.find((p) => p && claves.includes(p)) ?? claves[0]!)
    }
    case 'alZarparDescartar':
      return elegir(s.zonas.mano.length >= 4 ? 'si' : 'no')
    case 'conservarMision':
      return elegir('dejar')
    default:
      return elegir(claves[0]!)
  }
}

function repartir(s: Estado, d: Extract<Decision, { tipo: 'repartir' }>): Eleccion {
  const n: Partial<Record<InstId, number>> = {}
  let resto = d.cantidad
  const destinos = Object.keys(d.maximos) as InstId[]
  if (d.motivo.clave === 'heridas') {
    // Una a una, a quien más vida le quede (el Capitán, el último).
    const recibidas: Partial<Record<InstId, number>> = {}
    while (resto > 0) {
      const objetivo = [...destinos].sort((a, b) => {
        const va = vidaRestante(s, a) - (recibidas[a] ?? 0) - (a === s.capitan ? 50 : 0)
        const vb = vidaRestante(s, b) - (recibidas[b] ?? 0) - (b === s.capitan ? 50 : 0)
        return vb - va
      })[0]!
      recibidas[objetivo] = (recibidas[objetivo] ?? 0) + 1
      resto--
    }
    return { tipo: 'reparto', n: recibidas }
  }
  // Curar: primero al Capitán. Munición: en orden.
  destinos.sort((a, b) => (a === s.capitan ? -1 : b === s.capitan ? 1 : 0))
  for (const inst of destinos) {
    const poner = Math.min(resto, d.maximos[inst] ?? 0)
    n[inst] = poner
    resto -= poner
  }
  return { tipo: 'reparto', n }
}

function cubrirDistancia(s: Estado, d: Extract<Decision, { tipo: 'cubrirDistancia' }>): Eleccion {
  let mejor: { coste: number; ids: InstId[] } | null = null
  const cartas = [...d.cartas].sort((a, b) => iconos(s, b, 'NAV') - iconos(s, a, 'NAV'))
  for (let mascara = 0; mascara < 1 << d.tripulantes.length; mascara++) {
    const grupo = d.tripulantes.filter((_, i) => mascara & (1 << i))
    let nav = navParaDistancia(s, grupo)
    const usadas: InstId[] = []
    for (const c of cartas) {
      if (nav >= d.distancia) break
      usadas.push(c)
      nav += iconos(s, c, 'NAV')
    }
    if (nav < d.distancia) continue
    const coste = grupo.reduce((n, c) => n + (c === s.capitan ? 4 : 1 + valorTripulante(s, c) / 6), 0) + usadas.length
    if (!mejor || coste < mejor.coste) mejor = { coste, ids: [...grupo, ...usadas] }
  }
  return { tipo: 'cartas', ids: mejor?.ids ?? [...d.tripulantes, ...d.cartas] }
}

function ventana(s: Estado, d: Extract<Decision, { tipo: 'ventanaAccion' }>): Eleccion {
  const terminar: Eleccion = { tipo: 'accion', accion: { tipo: 'terminarPaso' } }
  switch (d.motivo.clave) {
    case 'jugarCartas':
      return elegirEnJugarCartas(s, d.acciones)
    case 'ventanaPrueba': {
      const total = totalPrueba(s)
      const dificultad = dificultadPrueba(s)
      if (total >= dificultad || s.prueba?.falla) return terminar
      const refuerzos = d.acciones.filter((a): a is Extract<Accion, { tipo: 'reforzar' }> => a.tipo === 'reforzar')
      const hab = s.prueba?.hab
      if (!hab || refuerzos.length === 0) return terminar
      const posibles = refuerzos.reduce((n, a) => n + iconos(s, a.carta, hab), 0)
      if (s.prueba?.sinCartas || total + posibles < dificultad) return terminar
      const mejor = [...refuerzos].sort((a, b) => iconos(s, b.carta, hab) - iconos(s, a.carta, hab))[0]!
      return { tipo: 'accion', accion: mejor }
    }
    case 'trasEncuentro': {
      const m = s.mision
      if (!m) return terminar
      const falta = valor(s, { tipo: 'avanceNecesario', mision: m.carta }) - copia(s, m.carta).avance
      const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada).length
      const iconosMano = s.zonas.mano.reduce((n, c) => n + iconosTotales(s, c), 0)
      const enMar = porId(copia(s, m.carta).id).tipo === 'capitulo' && encuentroEnMar(s)
      const barcoMal = enMar && s.danoBarco >= valor(s, { tipo: 'danoMaximo' }) - 2 && falta > 1
      const capitanMal = vidaRestante(s, s.capitan) <= 1 && falta > 1
      const sinFuerzas = preparados === 0 && iconosMano < 3 && falta >= 2
      const retirada = d.acciones.find((a) => a.tipo === 'retirarse')
      if (retirada && (barcoMal || capitanMal || sinFuerzas)) return { tipo: 'accion', accion: retirada }
      return terminar
    }
    default:
      return terminar
  }
}

function encuentroEnMar(s: Estado): boolean {
  const m = s.mision
  if (!m) return false
  const e = porId(copia(s, m.carta).id)
  return e.tipo === 'capitulo' && e.carta.entorno === 'mar'
}

export function jugadorConCriterio(): JugadorAutomatico {
  return (s, d) => {
    switch (d.tipo) {
      case 'ventanaAccion':
        return ventana(s, d)
      case 'elegirCartas':
        return elegirCartas(s, d)
      case 'elegirOpcion':
        return elegirOpcion(s, d)
      case 'ofrecer':
        return { tipo: 'pasar' }
      case 'repartir':
        return repartir(s, d)
      case 'cubrirDistancia':
        return cubrirDistancia(s, d)
      case 'comprometer':
        return elegirCompromiso(s, d)
    }
  }
}

/** Número de Peligros del mazo predefinido, para normalizar estadísticas. */
export const PELIGROS_EN_MAZO = DATOS.mazosPredefinidos.mazoDePeligros.length
