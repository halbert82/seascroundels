// Ayudas que comparten las capacidades de las cartas. Ojo: estos módulos se cargan a la vez que el registro
// de capacidades, así que nada de aquí se puede llamar al cargar un módulo (solo dentro de funciones).

import { esCanon, esUnica, porId } from '../catalogo.ts'
import type { Entorno, Habilidad } from '../datos.ts'
import { copia } from '../estado.ts'
import { curable } from '../estados.ts'
import { encuentroDe, entornoActual } from '../peligros.ts'
import type { Estado, Evento, InstId } from '../tipos.ts'
import { plazasLibres, valor } from '../valores.ts'

/** Entorno de una carta de misión en juego. */
export function entornoDeMision(s: Estado, mision: InstId): Entorno {
  const e = porId(copia(s, mision).id)
  if (e.tipo !== 'capitulo') throw new Error(`${e.id} no es una misión`)
  return e.carta.entorno
}

/** Cañones en juego a los que les falta munición. */
export function canonesSinCargar(s: Estado): InstId[] {
  return s.zonas.mejoras.filter((m) => esCanon(copia(s, m).id) && copia(s, m).municion < valor(s, { tipo: 'municionMaxima', carta: m }))
}

/** ¿Se puede reclutar ahora este Tripulante? (cabe en el Barco y, si es único, no hay otro en juego) */
export function reclutable(s: Estado, inst: InstId): boolean {
  const id = copia(s, inst).id
  if (porId(id).tipo !== 'tripulante' || plazasLibres(s) < 1) return false
  return !(esUnica(id) && [...s.zonas.tripulacion, ...s.zonas.rehenes].some((x) => copia(s, x).id === id))
}

/** Tripulantes del muelle que se pueden reclutar gratis con coste N o menos («Prisionero liberado»). */
export function reclutablesGratis(s: Estado, maxCoste: number): InstId[] {
  return s.zonas.muelle.filter((c) => reclutable(s, c) && valor(s, { tipo: 'coste', carta: c }) <= maxCoste)
}

/** ¿Participa este Tripulante en la Prueba en curso? (comprometido y en juego) */
export function participa(s: Estado, yo: InstId | null): boolean {
  return yo !== null && s.prueba !== null && s.prueba.comprometidos.includes(yo) && s.zonas.tripulacion.includes(yo)
}

/** Tripulantes que participan en la Prueba en curso. */
export function participantes(s: Estado): InstId[] {
  return s.prueba ? s.prueba.comprometidos.filter((c) => s.zonas.tripulacion.includes(c)) : []
}

/** Portador de una Mejora de tripulante (o Tesoro), si está en juego. */
export function portadorDe(s: Estado, yo: InstId | null): InstId | null {
  if (!yo) return null
  const v = copia(s, yo).vinculadaA
  return v && v !== 'barco' && s.zonas.tripulacion.includes(v) ? v : null
}

export function enEntorno(s: Estado, ...entornos: Entorno[]): boolean {
  const e = entornoActual(s)
  return e !== null && entornos.includes(e)
}

/** Acaba de revelarse esta carta de Peligro y sigue ahí, sin resolver. */
export function peligroRevelado(s: Estado, ev: Evento): ev is Extract<Evento, { tipo: 'revelarPeligro' }> {
  return ev.tipo === 'revelarPeligro' && s.zonas.encuentro.includes(ev.carta)
}

/** Una carta «con Prueba de X» lo es si alguna de sus opciones es de esa habilidad (D4). */
export function conPruebaDe(s: Estado, carta: InstId, hab: Habilidad): boolean {
  return encuentroDe(s, carta).prueba.some((o) => o.hab === hab)
}

/** Este Destino es el de la Prueba en curso y no se ha cancelado. */
export function destinoVigente(s: Estado, ev: Evento): ev is Extract<Evento, { tipo: 'revelarDestino' }> {
  return ev.tipo === 'revelarDestino' && s.prueba !== null && s.prueba.destino === ev.carta && !s.prueba.destinoCancelado
}

/** Hay algo que curar: heridas. */
export function hayHeridos(s: Estado): boolean {
  return s.zonas.tripulacion.some((c) => curable(s, c) > 0)
}

/** Hay algo que reparar: daño. */
export function hayQueReparar(s: Estado): boolean {
  return s.danoBarco > 0
}

export function hayAgotados(s: Estado): boolean {
  return s.zonas.tripulacion.some((c) => copia(s, c).agotada)
}

/** Vida que le queda a un Tripulante. */
export function vidaRestante(s: Estado, c: InstId): number {
  return valor(s, { tipo: 'vida', carta: c }) - copia(s, c).heridas
}
