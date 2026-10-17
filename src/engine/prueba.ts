// Cálculos de la Prueba en curso: total y dificultad, siempre en vivo (D1a), con la base congelada (D1b).

import { iconosDe, porId, rasgosDe } from './catalogo.ts'
import type { Habilidad } from './datos.ts'
import { destinoDe } from './destinos.ts'
import { copia } from './estado.ts'
import { encuentroDe } from './peligros.ts'
import type { Estado, InstId, PruebaEnCurso } from './tipos.ts'
import { modificadores, valor } from './valores.ts'

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
