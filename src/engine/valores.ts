// Valores calculados: nunca se guardan. Cada uno es su número impreso más los modificadores
// constantes activos (Mejoras preparadas, Tripulantes en juego, efectos temporales y el Barco).

import { capacidadPorClave, capacidadesDe } from './capacidades/index.ts'
import { porId } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { copia } from './estado.ts'
import { cartaDeEstado } from './infoEstados.ts'
import { reglasMision } from './misiones2/registro.ts'
import type { Capacidad, Consulta, Contexto, Estado, InstId } from './tipos.ts'
import { vinculadas } from './zonas.ts'

export function contexto(s: Estado, supuestasAgotadas?: ReadonlySet<InstId>, participantes?: readonly InstId[]): Contexto {
  const ctx: Contexto = { s, agotada: (inst) => copia(s, inst).agotada || (supuestasAgotadas?.has(inst) ?? false) }
  if (participantes) ctx.participantes = participantes
  return ctx
}

/**
 * Una Mejora aplica su texto si su portador está en juego (el Barco o un Tripulante; las de un rehén, no). Fase 10:
 * también agotada; agotada solo quiere decir que no puede pagar otra vez una capacidad «Agotar:» hasta prepararse.
 */
export function mejoraActiva(s: Estado, inst: InstId): boolean {
  const c = copia(s, inst)
  return c.vinculadaA === 'barco' || (c.vinculadaA !== null && s.zonas.tripulacion.includes(c.vinculadaA))
}

/** La carta cuyo Destino se aplica en la Prueba en curso (revelado y sin cancelar). */
export function destinoVigente(s: Estado): InstId | null {
  const p = s.prueba
  return p?.destino && !p.destinoCancelado && s.zonas.destino.includes(p.destino) ? p.destino : null
}

/** Capacidades constantes activas, con la carta que las da (null para temporales y Barco). */
function* constantesActivas(s: Estado): Generator<[Capacidad, InstId | null]> {
  for (const inst of s.zonas.tripulacion) {
    for (const cap of capacidadesDe(copia(s, inst).id)) {
      if (cap.ventana === 'constante' && cap.desde === 'juego') yield [cap, inst]
    }
  }
  for (const inst of s.zonas.mejoras) {
    const c = copia(s, inst)
    if (!mejoraActiva(s, inst)) continue
    for (const cap of capacidadesDe(c.id)) {
      if (cap.ventana === 'constante' && cap.desde === 'juego') yield [cap, inst]
    }
  }
  if (s.mision) {
    for (const cap of capacidadesDe(copia(s, s.mision.carta).id)) {
      if (cap.ventana === 'constante' && cap.desde === 'mision') yield [cap, s.mision.carta]
    }
  }
  // Misiones 2.0: los Pasajeros y las cartas de misión que están junto a la misión («¡La guardia!»).
  for (const inst of s.zonas.pasajeros) {
    for (const cap of capacidadesDe(copia(s, inst).id)) if (cap.ventana === 'constante' && cap.desde === 'pasajero') yield [cap, inst]
  }
  for (const t of s.temporales) {
    // «En tu próximo turno»: aún no cuenta.
    if (t.desdeTurno !== undefined && t.desdeTurno > s.turno) continue
    const cap = capacidadPorClave(t.clave)
    if (cap) yield [cap, t.inst ?? null]
  }
  for (const cap of capacidadesDe('barco')) {
    if (cap.ventana === 'constante' && cap.desde === 'barco') yield [cap, null]
  }
  // Fase 6: el encuentro que se resuelve, el Destino de la Prueba, cartas de Peligro en juego y fichas de Estado.
  for (const inst of s.zonas.encuentro) {
    for (const cap of capacidadesDe(copia(s, inst).id)) if (cap.ventana === 'constante' && cap.desde === 'encuentro') yield [cap, inst]
  }
  const destino = destinoVigente(s)
  if (destino) {
    for (const cap of capacidadesDe(copia(s, destino).id)) if (cap.ventana === 'constante' && cap.desde === 'destino') yield [cap, destino]
  }
  for (const inst of s.zonas.permanentes) {
    for (const cap of capacidadesDe(copia(s, inst).id)) if (cap.ventana === 'constante' && cap.desde === 'permanente') yield [cap, inst]
  }
  for (const inst of s.zonas.tripulacion) {
    for (const e of copia(s, inst).estados ?? []) {
      for (const cap of capacidadesDe(cartaDeEstado(e))) if (cap.ventana === 'constante' && cap.desde === 'estado') yield [cap, inst]
    }
  }
  for (const e of s.estadosBarco ?? []) {
    for (const cap of capacidadesDe(cartaDeEstado(e))) if (cap.ventana === 'constante' && cap.desde === 'estadoBarco') yield [cap, null]
  }
}

function base(s: Estado, c: Consulta): number {
  switch (c.tipo) {
    case 'habilidad': {
      const e = porId(copia(s, c.carta).id)
      const impresa = e.tipo === 'capitan' || e.tipo === 'tripulante' ? e.carta[c.hab] : 0
      return impresa + copia(s, c.carta).entrenamiento.filter((h) => h === c.hab).length
    }
    case 'vida': {
      const e = porId(copia(s, c.carta).id)
      return e.tipo === 'capitan' || e.tipo === 'tripulante' ? e.carta.vida : 0
    }
    case 'huecos': {
      const e = porId(copia(s, c.carta).id)
      return e.tipo === 'capitan' || e.tipo === 'tripulante' ? e.carta.mejoras : 0
    }
    case 'coste': {
      const e = porId(copia(s, c.carta).id).carta
      return 'coste' in e && typeof e.coste === 'number' ? e.coste : 0
    }
    case 'capacidad':
      return DATOS.barco.capacidad
    case 'espacio':
      return DATOS.barco.espacio
    case 'danoMaximo':
      return DATOS.barco.danoMaximo
    case 'mando': {
      const e = porId(copia(s, s.capitan).id)
      return e.tipo === 'capitan' ? e.carta.mando : 0
    }
    case 'objetivoRobo':
      return valor(s, { tipo: 'mando' })
    case 'dificultad':
      return c.base
    case 'totalPrueba':
    case 'heridaExtraFallo':
    case 'avanceExtraPrueba':
    case 'avanceExtraEncuentro':
    case 'sinCanones':
    case 'sinAgotarAlComprometer':
    case 'noSuma':
    case 'sinNavBarco':
      return 0
    case 'distancia':
    case 'avanceNecesario': {
      const e = porId(copia(s, c.mision).id)
      if (e.tipo !== 'capitulo') throw new Error(`${e.id} no es una misión`)
      if (c.tipo === 'avanceNecesario') return e.carta.avanceNecesario
      // «Si El guía del istmo viaja contigo, la Distancia de esta misión es 0.»
      const distancia = reglasMision(e.id)?.distancia
      return distancia ? distancia(s, e.carta.distancia) : e.carta.distancia
    }
  }
}

/**
 * Valor actual de algo: número impreso + modificadores activos, nunca por debajo de 0.
 * `supuestasAgotadas`: calcula como si esas cartas ya estuvieran agotadas (agotarse a la vez, D1a).
 * `participantes`: para prever una Prueba, quiénes participarían en ella.
 */
export function valor(s: Estado, c: Consulta, supuestasAgotadas?: ReadonlySet<InstId>, participantes?: readonly InstId[]): number {
  // D7: una misión sin Distancia (de Mar o en tu isla) sigue en 0 pase lo que pase.
  if (c.tipo === 'distancia' && base(s, c) === 0) return 0
  return Math.max(0, valorSinMinimo(s, c, supuestasAgotadas, participantes))
}

/**
 * Número impreso + modificadores activos, sin el mínimo de 0. Para la dificultad de una Prueba, que suma también el
 * Destino y solo al final no baja de 0 (P61).
 */
export function valorSinMinimo(s: Estado, c: Consulta, supuestasAgotadas?: ReadonlySet<InstId>, participantes?: readonly InstId[]): number {
  const ctx = contexto(s, supuestasAgotadas, participantes)
  let total = base(s, c)
  const sinMejoras = deLaPrueba(s, c)
  for (const [cap, yo] of constantesActivas(s)) {
    if (sinMejoras && yo !== null && s.zonas.mejoras.includes(yo)) continue
    total += cap.modifica?.(ctx, yo, c) ?? 0
  }
  return total
}

/** «Las Mejoras no suman en esta Prueba»: no cuentan para las habilidades ni para el total. */
function deLaPrueba(s: Estado, c: Consulta): boolean {
  return (s.prueba?.sinMejoras || s.prueba?.mejorasNoSuman || false) && (c.tipo === 'habilidad' || c.tipo === 'totalPrueba')
}

/** Lo que aporta cada capacidad constante activa a una consulta (solo las que suman o restan algo). */
export function aportaciones(s: Estado, c: Consulta): { carta: string; clave: string; inst: InstId | null; n: number }[] {
  const ctx = contexto(s)
  const lista: { carta: string; clave: string; inst: InstId | null; n: number }[] = []
  const sinMejoras = deLaPrueba(s, c)
  for (const [cap, yo] of constantesActivas(s)) {
    if (sinMejoras && yo !== null && s.zonas.mejoras.includes(yo)) continue
    const n = cap.modifica?.(ctx, yo, c) ?? 0
    if (n !== 0) lista.push({ carta: cap.carta, clave: cap.clave, inst: yo, n })
  }
  return lista
}

/** Suma de los modificadores activos de una consulta, sin número base ni mínimo. */
export function modificadores(s: Estado, c: Consulta): number {
  const ctx = contexto(s)
  let total = 0
  const sinMejoras = deLaPrueba(s, c)
  for (const [cap, yo] of constantesActivas(s)) {
    if (sinMejoras && yo !== null && s.zonas.mejoras.includes(yo)) continue
    total += cap.modifica?.(ctx, yo, c) ?? 0
  }
  return total
}

/** NAV que suman unos Tripulantes al agotarse juntos para cubrir una Distancia (D1a). */
export function navParaDistancia(s: Estado, agotados: readonly InstId[]): number {
  const supuestas = new Set(agotados)
  return agotados.reduce((suma, inst) => suma + valor(s, { tipo: 'habilidad', carta: inst, hab: 'NAV' }, supuestas), 0)
}

/** Espacio que ocupan las Mejoras de barco (los Tesoros no ocupan). */
export function espacioOcupado(s: Estado): number {
  return vinculadas(s, 'barco').reduce((suma, m) => {
    const e = porId(copia(s, m).id)
    return suma + (e.tipo === 'mejoraBarco' ? e.carta.espacio : 0)
  }, 0)
}

export function espacioLibre(s: Estado): number {
  return valor(s, { tipo: 'espacio' }) - espacioOcupado(s)
}

/** Huecos de Mejora ocupados en un Tripulante: Mejoras (no Tesoros) y fichas de Entrenamiento. */
export function huecosOcupados(s: Estado, tripulante: InstId): number {
  const mejoras = vinculadas(s, tripulante).filter((m) => porId(copia(s, m).id).tipo === 'mejoraTripulante').length
  return mejoras + copia(s, tripulante).entrenamiento.length
}

export function huecosLibres(s: Estado, tripulante: InstId): number {
  return valor(s, { tipo: 'huecos', carta: tripulante }) - huecosOcupados(s, tripulante)
}

/** Plazas del Barco ocupadas: Tripulantes sin contar al Capitán, más los rehenes, los incautados y los Pasajeros. */
export function plazasOcupadas(s: Estado): number {
  // Un Tripulante incautado sigue ocupando su plaza (P9).
  const incautados = s.zonas.incautadas.filter((c) => porId(copia(s, c).id).tipo === 'tripulante').length
  return s.zonas.tripulacion.filter((t) => t !== s.capitan).length + s.zonas.rehenes.length + incautados + s.zonas.pasajeros.length
}

export function plazasLibres(s: Estado): number {
  return valor(s, { tipo: 'capacidad' }) - plazasOcupadas(s)
}

