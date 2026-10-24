// Valores calculados: nunca se guardan. Cada uno es su número impreso más los modificadores
// constantes activos (Mejoras preparadas, Tripulantes en juego, efectos temporales y el Barco).

import { capacidadPorClave, capacidadesDe } from './capacidades/index.ts'
import { costeImpreso, iconosDe, porId } from './catalogo.ts'
import { DATOS, type Habilidad } from './datos.ts'
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
 * Una Mejora aplica su texto si su portador está en juego (el Barco o un Tripulante). Fase 10:
 * también agotada; agotada solo quiere decir que no puede pagar otra vez una capacidad «Agotar:» hasta prepararse.
 */
export function mejoraActiva(s: Estado, inst: InstId): boolean {
  const c = copia(s, inst)
  return c.vinculadaA === 'barco' || (c.vinculadaA !== null && s.zonas.tripulacion.includes(c.vinculadaA))
}

/** La carta cuyo Destino se aplica en la Prueba en curso (revelado y sin cancelar). */
export function destinosVigentes(s: Estado): InstId[] {
  const p = s.prueba
  if (!p) return []
  // Fase 13: dos Destinos en «Bruma en la selva»; cada uno vale mientras no se cancele.
  const lista: InstId[] = []
  if (p.destino && !p.destinoCancelado && s.zonas.destino.includes(p.destino)) lista.push(p.destino)
  if (p.segundoDestino && !p.segundoCancelado && s.zonas.destino.includes(p.segundoDestino)) lista.push(p.segundoDestino)
  return lista
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
  for (const destino of destinosVigentes(s)) {
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

/** Fase 15, «Destina X»: lo que suman unos Tripulantes de esa habilidad al agotarse juntos (como al cubrir una Distancia). */
export function habilidadAlAgotarse(s: Estado, agotados: readonly InstId[], hab: Habilidad): number {
  const supuestas = new Set(agotados)
  return agotados.reduce((suma, inst) => suma + valor(s, { tipo: 'habilidad', carta: inst, hab }, supuestas), 0)
}

/**
 * Lo que se cubre al elegir Tripulantes (y cartas) para una Distancia o para «Destina X [habilidad]»: NAV en una Distancia;
 * en «Destina», la habilidad que diga (NAV en los alisios, COM en «¡Nadie se queda atrás!»).
 */
export function habilidadQueSeCubre(motivo: { clave: string; texto?: string }): Habilidad {
  return motivo.clave === 'destina' && (motivo.texto === 'COM' || motivo.texto === 'EXP') ? motivo.texto : 'NAV'
}

/** Lo que suman esos Tripulantes al agotarse juntos y esas cartas por sus iconos, en la habilidad que se cubre. */
export function sumaParaCubrir(s: Estado, motivo: { clave: string; texto?: string }, tripulantes: readonly InstId[], cartas: readonly InstId[]): number {
  const hab = habilidadQueSeCubre(motivo)
  const deTripulantes = hab === 'NAV' ? navParaDistancia(s, tripulantes) : habilidadAlAgotarse(s, tripulantes, hab)
  return deTripulantes + cartas.reduce((n, c) => n + iconosDe(copia(s, c).id, hab), 0)
}

/** Lo más que suma el mejor grupo de Tripulantes preparados al agotarse juntos (para saber si se puede pagar «Destina X»). */
export function maximoParaDestina(s: Estado, hab: Habilidad): number {
  const lista = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada)
  let mejor = 0
  for (let mascara = 1; mascara < 1 << lista.length; mascara++) {
    mejor = Math.max(mejor, habilidadAlAgotarse(s, lista.filter((_, i) => mascara & (1 << i)), hab))
  }
  return mejor
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

/**
 * Plazas del Barco ocupadas: los Tripulantes sin contar al Capitán (fase 14: ya no hay rehenes; fase 15: los Pasajeros
 * ya no ocupan Capacidad, porque no son Tripulantes).
 */
export function plazasOcupadas(s: Estado): number {
  return s.zonas.tripulacion.filter((t) => t !== s.capitan).length
}

export function plazasLibres(s: Estado): number {
  return valor(s, { tipo: 'capacidad' }) - plazasOcupadas(s)
}


/**
 * Fase 14 (regla general de Albert): cuando una carta habla del coste de otra («de coste 2 o menos»), mira siempre el
 * coste impreso; los descuentos (Catalina, Marineros sin barco…) solo rebajan lo que se paga. «Pagando la mitad de su
 * coste, redondeando hacia arriba»: primero la mitad del coste impreso y después los descuentos (nunca menos de 0). P92,
 * confirmado por Albert, como dice la entrada Coste.
 */
export function costeAPagar(s: Estado, carta: InstId, modo: 'normal' | 'mitad' | 'gratis' = 'normal'): number {
  if (modo === 'gratis') return 0
  if (modo === 'normal') return valor(s, { tipo: 'coste', carta })
  return Math.max(0, Math.ceil(costeImpreso(copia(s, carta).id) / 2) + modificadores(s, { tipo: 'coste', carta }))
}
