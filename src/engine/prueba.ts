// Cálculos de la Prueba en curso: total y dificultad, siempre en vivo (D1a), con la base congelada (D1b).

import { iconosDe, nombreDe, porId, rasgosDe } from './catalogo.ts'
import type { Habilidad } from './datos.ts'
import { destinoDe } from './destinos.ts'
import { copia } from './estado.ts'
import { encuentroDe } from './peligros.ts'
import type { Estado, InstId, PruebaEnCurso } from './tipos.ts'
import { aportaciones, modificadores, valor } from './valores.ts'

export function pruebaEnCurso(s: Estado): PruebaEnCurso {
  if (!s.prueba) throw new Error('No hay ninguna Prueba en curso')
  return s.prueba
}

/** ¿Hay un Tripulante preparado con ese Rasgo? */
export function hayRasgoPreparado(s: Estado, rasgo: string): boolean {
  return s.zonas.tripulacion.some((c) => !copia(s, c).agotada && rasgosDe(copia(s, c).id).includes(rasgo))
}

/** Dificultad de una opción antes de los modificadores (con la rebaja por Rasgo si se cumple ahora). */
export function dificultadDeOpcion(s: Estado, encuentro: InstId, opcion: number): number {
  const o = encuentroDe(s, encuentro).prueba[opcion]
  if (!o) throw new Error(`Opción de Prueba inexistente: ${opcion}`)
  return o.alternativa && hayRasgoPreparado(s, o.alternativa.rasgo) ? o.alternativa.dificultad : o.dificultad
}

function sinCanones(s: Estado, p: PruebaEnCurso): boolean {
  return p.sinCanones || valor(s, { tipo: 'sinCanones' }) > 0
}

/** Total de la Prueba en curso. */
export function totalPrueba(s: Estado): number {
  const p = pruebaEnCurso(s)
  if (!p.hab) return 0
  const hab = p.hab
  let total = 0
  for (const c of p.comprometidos) {
    if (s.zonas.tripulacion.includes(c)) total += valor(s, { tipo: 'habilidad', carta: c, hab })
  }
  if (!p.sinCartas) total += p.iconos
  const canones = sinCanones(s, p)
  for (const b of p.bonos) if (!(b.canon && canones)) total += b.n
  return total + modificadores(s, { tipo: 'totalPrueba', hab })
}

/** Palabras clave del encuentro en curso. */
export function clavesDelEncuentro(s: Estado, encuentro: InstId): string[] {
  return encuentroDe(s, encuentro).palabrasClave
}

/** Modificador de un Destino a esta Prueba («+2 en su lugar» si se cumple su condición). */
export function modificadorDeDestino(s: Estado, destino: InstId, encuentro: InstId, hab: Habilidad): number | 'fallo' {
  const d = destinoDe(copia(s, destino).id)
  if (d.modificador === 'fallo') return 'fallo'
  if (d.siClave && clavesDelEncuentro(s, encuentro).some((k) => d.siClave?.claves.includes(k))) return d.siClave.n
  if (d.siHabilidad && d.siHabilidad.hab === hab) return d.siHabilidad.n
  return d.modificador
}

/** Dificultad actual de la Prueba en curso. */
export function dificultadPrueba(s: Estado): number {
  const p = pruebaEnCurso(s)
  if (!p.hab) return 0
  const d = valor(s, { tipo: 'dificultad', base: p.dificultadBase, hab: p.hab, claves: clavesDelEncuentro(s, p.encuentro) })
  return Math.max(0, d + p.modDestino)
}

/**
 * Previsión antes de comprometer (para la interfaz y los jugadores automáticos): total y dificultad
 * si se eligen esa opción, esos Tripulantes (se agotan a la vez, D1a) y esas cartas, sin Destino.
 */
export function prevision(s: Estado, encuentro: InstId, opcion: number, tripulantes: readonly InstId[], cartas: readonly InstId[]) {
  const o = encuentroDe(s, encuentro).prueba[opcion]
  if (!o) throw new Error(`Opción de Prueba inexistente: ${opcion}`)
  const supuestas = new Set(tripulantes)
  let total = 0
  for (const c of tripulantes) total += valor(s, { tipo: 'habilidad', carta: c, hab: o.hab }, supuestas, tripulantes)
  for (const c of cartas) total += iconosDe(copia(s, c).id, o.hab)
  total += modificadores(s, { tipo: 'totalPrueba', hab: o.hab })
  const base = dificultadDeOpcion(s, encuentro, opcion)
  const dificultad = valor(s, { tipo: 'dificultad', base, hab: o.hab, claves: encuentroDe(s, encuentro).palabrasClave })
  return { total, dificultad }
}

/** Nombre del encuentro de una carta en la misión en curso. */
export function nombreDelEncuentro(s: Estado, carta: InstId): string {
  const e = porId(copia(s, carta).id)
  return e.tipo === 'peligro' || e.tipo === 'mazoPropio' ? encuentroDe(s, carta).nombre : e.id
}

/** Una parte de la suma del total o de la dificultad, para enseñarla en la mesa. */
export interface ParteDesglose {
  /** Lo que la produce: un Tripulante, una carta, una capacidad, la misión, el Destino… */
  etiqueta: string
  n: number
  /** De qué tipo es, para dibujarla. */
  tipo: 'tripulante' | 'carta' | 'bono' | 'modificador' | 'base' | 'destino'
  /** Copia o carta que la produce, si la hay. */
  inst?: InstId
  carta?: string
  /** No cuenta («Los Cañones no suman», «Las cartas de tu mano no suman», Destino cancelado). */
  anulada?: boolean
}

/** Desglose del total de la Prueba en curso. Las partes no anuladas suman exactamente `totalPrueba`. */
export function desgloseTotal(s: Estado): ParteDesglose[] {
  const p = pruebaEnCurso(s)
  if (!p.hab) return []
  const hab = p.hab
  const partes: ParteDesglose[] = []
  for (const c of p.comprometidos) {
    if (!s.zonas.tripulacion.includes(c)) continue
    partes.push({ etiqueta: nombreDe(copia(s, c).id), n: valor(s, { tipo: 'habilidad', carta: c, hab }), tipo: 'tripulante', inst: c })
  }
  for (const c of p.cartas) {
    const n = iconosDe(copia(s, c).id, hab)
    if (n > 0) partes.push({ etiqueta: nombreDe(copia(s, c).id), n, tipo: 'carta', inst: c, anulada: p.sinCartas })
  }
  const canones = sinCanones(s, p)
  for (const b of p.bonos) partes.push({ etiqueta: nombreDe(b.fuente), n: b.n, tipo: 'bono', carta: b.fuente, anulada: b.canon && canones })
  for (const a of aportaciones(s, { tipo: 'totalPrueba', hab })) {
    const parte: ParteDesglose = { etiqueta: nombreDe(a.carta), n: a.n, tipo: 'modificador', carta: a.carta }
    if (a.inst) parte.inst = a.inst
    partes.push(parte)
  }
  return partes
}

/** Desglose de la dificultad de la Prueba en curso. Suma `dificultadPrueba` (salvo si quedaría por debajo de 0). */
export function desgloseDificultad(s: Estado): ParteDesglose[] {
  const p = pruebaEnCurso(s)
  if (!p.hab) return []
  const enc = encuentroDe(s, p.encuentro)
  const partes: ParteDesglose[] = [{ etiqueta: enc.nombre, n: p.dificultadBase, tipo: 'base', inst: p.encuentro }]
  for (const a of aportaciones(s, { tipo: 'dificultad', base: p.dificultadBase, hab: p.hab, claves: clavesDelEncuentro(s, p.encuentro) })) {
    partes.push({ etiqueta: nombreDe(a.carta), n: a.n, tipo: 'modificador', carta: a.carta })
  }
  if (p.destino) {
    const d = destinoDe(copia(s, p.destino).id)
    partes.push({ etiqueta: d.nombre, n: p.modDestino, tipo: 'destino', inst: p.destino, anulada: p.destinoCancelado })
  }
  return partes
}
