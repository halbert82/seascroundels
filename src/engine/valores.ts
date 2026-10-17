// Valores calculados: nunca se guardan. Cada uno es su número impreso más los modificadores
// constantes activos (Mejoras preparadas, Tripulantes en juego, efectos temporales y el Barco).

import { capacidadPorClave, capacidadesDe } from './capacidades/index.ts'
import { porId } from './catalogo.ts'
import { DATOS } from './datos.ts'
import { copia } from './estado.ts'
import type { Capacidad, Consulta, Contexto, Estado, InstId } from './tipos.ts'
import { vinculadas } from './zonas.ts'

export function contexto(s: Estado, supuestasAgotadas?: ReadonlySet<InstId>, participantes?: readonly InstId[]): Contexto {
  const ctx: Contexto = { s, agotada: (inst) => copia(s, inst).agotada || (supuestasAgotadas?.has(inst) ?? false) }
  if (participantes) ctx.participantes = participantes
  return ctx
}

/**
 * Una Mejora aplica su texto si está preparada y su portador está en juego (el Barco o un Tripulante;
 * las de un rehén, no).
 */
export function mejoraActiva(s: Estado, inst: InstId): boolean {
  const c = copia(s, inst)
  if (c.agotada) return false
  return c.vinculadaA === 'barco' || (c.vinculadaA !== null && s.zonas.tripulacion.includes(c.vinculadaA))
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
  for (const t of s.temporales) {
    const cap = capacidadPorClave(t.clave)
    if (cap) yield [cap, t.inst ?? null]
  }
  for (const cap of capacidadesDe('barco')) {
    if (cap.ventana === 'constante' && cap.desde === 'barco') yield [cap, null]
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
    case 'municionMaxima': {
      const e = porId(copia(s, c.carta).id)
      return e.tipo === 'mejoraBarco' ? e.carta.municion : 0
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
    case 'sinCanones':
    case 'sinAgotarAlComprometer':
      return 0
    case 'distancia':
    case 'avanceNecesario': {
      const e = porId(copia(s, c.mision).id)
      if (e.tipo !== 'capitulo') throw new Error(`${e.id} no es una misión`)
      return c.tipo === 'distancia' ? e.carta.distancia : e.carta.avanceNecesario
    }
  }
}

/**
 * Valor actual de algo: número impreso + modificadores activos, nunca por debajo de 0.
 * `supuestasAgotadas`: calcula como si esas cartas ya estuvieran agotadas (agotarse a la vez, D1a).
 * `participantes`: para prever una Prueba, quiénes participarían en ella.
 */
export function valor(s: Estado, c: Consulta, supuestasAgotadas?: ReadonlySet<InstId>, participantes?: readonly InstId[]): number {
  const b = base(s, c)
  // D7: una misión sin Distancia (de Mar o en tu isla) sigue en 0 pase lo que pase.
  if (c.tipo === 'distancia' && b === 0) return 0
  const ctx = contexto(s, supuestasAgotadas, participantes)
  let total = b
  for (const [cap, yo] of constantesActivas(s)) total += cap.modifica?.(ctx, yo, c) ?? 0
  return Math.max(0, total)
}

/** Lo que aporta cada capacidad constante activa a una consulta (solo las que suman o restan algo). */
export function aportaciones(s: Estado, c: Consulta): { carta: string; clave: string; inst: InstId | null; n: number }[] {
  const ctx = contexto(s)
  const lista: { carta: string; clave: string; inst: InstId | null; n: number }[] = []
  for (const [cap, yo] of constantesActivas(s)) {
    const n = cap.modifica?.(ctx, yo, c) ?? 0
    if (n !== 0) lista.push({ carta: cap.carta, clave: cap.clave, inst: yo, n })
  }
  return lista
}

/** Suma de los modificadores activos de una consulta, sin número base ni mínimo. */
export function modificadores(s: Estado, c: Consulta): number {
  const ctx = contexto(s)
  let total = 0
  for (const [cap, yo] of constantesActivas(s)) total += cap.modifica?.(ctx, yo, c) ?? 0
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

/** Plazas del Barco ocupadas: Tripulantes sin contar al Capitán, más los rehenes. */
export function plazasOcupadas(s: Estado): number {
  return s.zonas.tripulacion.filter((t) => t !== s.capitan).length + s.zonas.rehenes.length
}

export function plazasLibres(s: Estado): number {
  return valor(s, { tipo: 'capacidad' }) - plazasOcupadas(s)
}

