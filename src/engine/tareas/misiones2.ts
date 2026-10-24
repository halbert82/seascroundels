// Pasos de las reglas nuevas de las misiones 2.0: fichas sobre la misión, Pasajeros y final con elección.

import { porId } from '../catalogo.ts'
import { anotar, copia, encolar, nombre } from '../estado.ts'
import { reglasDeRecompensa, reglasMision } from '../misiones2/registro.ts'
import type { InstId, NuevaTarea } from '../tipos.ts'
import { mover } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'

/** Pon (o quita) fichas sobre la misión en curso y aplica lo que diga la misión al llegar a su número. */
export const fichasMision: Manejador<'fichasMision'> = (s, t) => {
  const m = s.mision
  if (!m) return 'hecha'
  const reglas = reglasMision(copia(s, m.carta).id)
  const info = reglas?.fichas?.find((f) => f.ficha === t.ficha)
  const antes = m.fichas?.[t.ficha] ?? 0
  const ahora = Math.max(0, antes + t.n)
  if (ahora === antes) return 'hecha'
  m.fichas = { ...m.fichas, [t.ficha]: ahora }
  const cambio = ahora > antes ? `+${ahora - antes}` : `−${antes - ahora}`
  anotar(s, 'efecto', `${info?.nombre ?? t.ficha}: ${cambio} (${ahora}${info?.umbral ? ` de ${info.umbral}` : ''}).`, { tipo: 'fichasMision', ficha: t.ficha, n: ahora })
  if (!m.fin) encolar(s, ...(reglas?.alCambiarFichas?.(s, t.ficha, antes, ahora) ?? []))
  return 'hecha'
}

/**
 * Un Pasajero entra en juego. Fase 15: ya no ocupa Capacidad (no es un Tripulante; su carta dice todo lo necesario).
 * La carta estaba apartada (en el mazo de historia); si ya viaja contigo, no pasa nada.
 */
export const ponerPasajero: Manejador<'ponerPasajero'> = (s, t) => {
  if (s.zonas.pasajeros.some((c) => copia(s, c).id === t.carta)) return 'hecha'
  const carta = (Object.keys(s.cartas) as InstId[]).find((i) => copia(s, i).id === t.carta)
  if (!carta) return 'hecha'
  mover(s, carta, 'pasajeros', 'abajo')
  anotar(s, 'aviso', `${nombre(s, carta)} sube a bordo como Pasajero.`)
  return 'hecha'
}

/** Un Pasajero se va: deja de ocupar Capacidad y vuelve a apartarse. */
export const bajarPasajero: Manejador<'bajarPasajero'> = (s, t) => {
  const carta = s.zonas.pasajeros.find((c) => copia(s, c).id === t.carta)
  if (!carta) return 'hecha'
  mover(s, carta, 'mazoHistoria', 'abajo')
  anotar(s, 'aviso', `${nombre(s, carta)} ${t.motivo}: deja el Barco.`)
  return 'hecha'
}

/**
 * Fase 15 (Albert, tercera ronda): «Coge la carta N del mazo de historia». La carta sale del mazo de historia, se hace lo
 * que dice y, al terminar, vuelve a él (regla general: lo que sale del juego vuelve al mazo de historia).
 */
export const cogerCarta: Manejador<'cogerCarta'> = (s, t) => {
  const carta = s.zonas.mazoHistoria.find((c) => porId(copia(s, c).id).num === t.num)
  if (!carta) {
    anotar(s, 'efecto', `La carta ${t.num} no está en el mazo de historia: no ocurre nada.`)
    return 'hecha'
  }
  const id = copia(s, carta).id
  const reglas = reglasDeRecompensa(id)
  if (!reglas) throw new Error(`Carta de recompensa sin efecto: ${id}`)
  mover(s, carta, 'cogidas', 'abajo')
  anotar(s, 'aviso', `Coges la carta ${t.num} del mazo de historia: «${nombre(s, carta)}».`)
  encolar(s, ...reglas.efecto(s, carta), { tipo: 'devolverCogida', carta })
  return 'hecha'
}

/** La carta de recompensa cogida vuelve al mazo de historia cuando se ha hecho lo que dice. */
export const devolverCogida: Manejador<'devolverCogida'> = (s, t) => {
  if (!s.zonas.cogidas.includes(t.carta)) return 'hecha'
  mover(s, t.carta, 'mazoHistoria', 'abajo')
  anotar(s, 'efecto', `«${nombre(s, t.carta)}» vuelve al mazo de historia.`)
  return 'hecha'
}

/** Texto de una opción de final con elección: «Rescatas a tu amigo: +5 de reputación». */
export function textoOpcionFinal(o: { texto: string; rep?: number; tesoro?: string; efecto?: string }): string {
  const partes = [o.rep ? `+${o.rep} de reputación` : '', o.tesoro ? `el Tesoro «${porId(o.tesoro).carta.nombre}»` : '', o.efecto ?? ''].filter(Boolean)
  return partes.length > 0 ? `${o.texto}: ${partes.join(', ')}` : o.texto
}

/**
 * Final con elección: eliges una de las opciones de la carta de recompensa cogida («Ante el altar»; fase 15, cuarta ronda:
 * antes estaban en la propia misión).
 */
export const elegirFinal: Manejador<'elegirFinal'> = (s, t, e) => {
  const entrada = porId(copia(s, t.carta).id)
  // Una partida guardada antes de la cuarta ronda de la fase 15 con el final a medio elegir: el capítulo ya no tiene las
  // opciones; están en su carta de recompensa, que se coge ahora.
  if (entrada.tipo === 'capitulo') {
    const num = entrada.carta.recompensa.coge
    if (num !== undefined) encolar(s, { tipo: 'cogerCarta', num })
    return 'hecha'
  }
  if (entrada.tipo !== 'recompensa') return 'hecha'
  const opciones = entrada.carta.elige ?? []
  if (opciones.length === 0) return 'hecha'
  if (!e) {
    return preguntar({
      tipo: 'elegirOpcion',
      motivo: { clave: 'finalMision', carta: entrada.id },
      opciones: opciones.map((o) => ({ clave: o.clave, texto: textoOpcionFinal(o) })),
    })
  }
  const clave = eleccionDe(e, 'opcion').clave
  const o = opciones.find((x) => x.clave === clave)
  if (!o) return 'hecha'
  anotar(s, 'jugada', `Eliges el final: ${o.texto}.`)
  const tareas: NuevaTarea[] = []
  if (o.rep) tareas.push({ tipo: 'cambiarReputacion', n: o.rep })
  if (o.tesoro) {
    const tesoro = s.zonas.mazoHistoria.find((c) => copia(s, c).id === o.tesoro)
    if (tesoro) tareas.push({ tipo: 'ponerTesoro', carta: tesoro })
  }
  tareas.push(...(reglasDeRecompensa(entrada.id)?.alElegir?.(s, o.clave) ?? []))
  encolar(s, ...tareas)
  return 'hecha'
}
