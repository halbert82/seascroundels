// Ayudas para escribir las reglas de los Peligros 2.0 de forma corta y legible.

import { rasgosDe } from '../catalogo.ts'
import type { CapacidadDeCarta } from '../definiciones.ts'
import type { AccionSobre, Efecto, Selector } from '../efectos.ts'
import { copia } from '../estado.ts'
import { clavesDelEncuentro } from '../prueba.ts'
import type { Consulta, Contexto, Estado, InstId } from '../tipos.ts'
import { vinculadas } from '../zonas.ts'
import { porId } from '../catalogo.ts'
import type { Habilidad } from '../datos.ts'

/** Tripulantes que participan en la Prueba en curso (o que participarían, al prever). */
export function participantesCtx(ctx: Contexto): readonly InstId[] {
  const p = ctx.s.prueba
  return ctx.participantes ?? (p ? p.comprometidos.filter((c) => ctx.s.zonas.tripulacion.includes(c)) : [])
}

export function tieneRasgo(s: Estado, c: InstId, rasgo: string): boolean {
  return rasgosDe(copia(s, c).id).includes(rasgo)
}

/** Cuántos participantes tienen ese Rasgo. */
export function participantesCon(ctx: Contexto, rasgo: string): number {
  return participantesCtx(ctx).filter((c) => tieneRasgo(ctx.s, c, rasgo)).length
}

/** Mejoras de barco en juego (sin contar Tesoros). */
export function mejorasDeBarco(s: Estado): number {
  return vinculadas(s, 'barco').filter((m) => porId(copia(s, m).id).tipo === 'mejoraBarco').length
}

export function municionTotal(s: Estado): number {
  return s.zonas.mejoras.reduce((n, m) => n + copia(s, m).municion, 0)
}

/** El encuentro de la Prueba en curso tiene alguna de estas palabras clave. */
export function encuentroEs(s: Estado, ...claves: string[]): boolean {
  return s.prueba !== null && clavesDelEncuentro(s, s.prueba.encuentro).some((k) => claves.includes(k))
}

/** Modificador constante a la dificultad de la Prueba de este encuentro. */
export function dificultad(clave: string, n: (ctx: Contexto) => number): CapacidadDeCarta {
  return { clave, ventana: 'constante', modifica: (ctx, _yo, c: Consulta) => (c.tipo === 'dificultad' ? n(ctx) : 0) }
}

/** Modificador constante a la habilidad de cada participante que cumpla algo. */
export function habilidadDe(clave: string, n: (ctx: Contexto, c: InstId) => number): CapacidadDeCarta {
  return {
    clave,
    ventana: 'constante',
    modifica: (ctx, _yo, q: Consulta) => (q.tipo === 'habilidad' && participantesCtx(ctx).includes(q.carta) ? n(ctx, q.carta) : 0),
  }
}

/** Los participantes que cumplan algo no suman. */
export function noSuman(clave: string, si: (s: Estado, c: InstId) => boolean): CapacidadDeCarta {
  return { clave, ventana: 'constante', modifica: (ctx, _yo, q: Consulta) => (q.tipo === 'noSuma' && si(ctx.s, q.carta) ? 1 : 0) }
}

// Efectos cortos ---------------------------------------------------------------

export const avance = (n: number): Efecto => ({ tipo: 'ganarAvance', n })
export const pierdesAvance = (n: number): Efecto => ({ tipo: 'perderAvance', n })
export const dano = (n: number): Efecto => ({ tipo: 'dano', n })
export const heridas = (n: number): Efecto => ({ tipo: 'heridas', n })
/** «N heridas repartidas entre los Tripulantes asignados», «un Tripulante asignado sufre N heridas» (fase 10). */
export const heridasAsignados = (n: number): Efecto => ({ tipo: 'heridas', n, asignados: true })
export const robar = (n: number): Efecto => ({ tipo: 'robar', n })
export const descartar = (n: number): Efecto => ({ tipo: 'descartar', n })
export const municion = (n: number): Efecto => ({ tipo: 'ganarMunicion', n })
export const pierdesMunicion = (n: number): Efecto => ({ tipo: 'perderMunicion', n })
export const preparar = (n: number | 'todos' | 'comprometidos'): Efecto => ({ tipo: 'preparar', n })
export const reparar = (n: number): Efecto => ({ tipo: 'reparar', n })
export const agotar = (n: number): Efecto => ({ tipo: 'agotar', n })
export const reputacion = (n: number): Efecto => ({ tipo: 'reputacion', n })
export const codigo = (clave: string): Efecto => ({ tipo: 'codigo', clave })

/** «El comprometido con más EXP …» */
export function comprometidoCon(por: Selector['por'], hacer: AccionSobre): Efecto {
  return por ? { tipo: 'aQuien', quien: { de: 'comprometidos', por }, hacer } : { tipo: 'aQuien', quien: { de: 'comprometidos' }, hacer }
}

export const mas = (hab: Habilidad | 'prueba'): Selector['por'] => ({ mas: hab })
export const menos = (hab: Habilidad | 'prueba'): Selector['por'] => ({ menos: hab })

/** «Cada Tripulante comprometido …» */
export function cadaComprometido(hacer: AccionSobre): Efecto {
  return { tipo: 'aQuien', quien: { de: 'comprometidos', cada: true }, hacer }
}

/** «Si tienes un X…» */
export function siTienes(rasgo: string, entonces: Efecto[], sino?: Efecto[]): Efecto {
  return sino ? { tipo: 'si', condicion: { tipo: 'rasgoEnJuego', rasgo }, entonces, sino } : { tipo: 'si', condicion: { tipo: 'rasgoEnJuego', rasgo }, entonces }
}

/** «En el Mar, …; en Naturaleza o Ciudad, …» (los Destinos que dañaban el Barco dicen qué hacen en cada Entorno). */
export function enElMar(mar: Efecto[], enTierra: Efecto[]): Efecto {
  return { tipo: 'si', condicion: { tipo: 'entorno', entorno: 'mar' }, entonces: mar, sino: enTierra }
}
