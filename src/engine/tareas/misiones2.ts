// Pasos de las reglas nuevas de las misiones 2.0: fichas sobre la misión, Pasajeros y final con elección.

import { porId } from '../catalogo.ts'
import { anotar, copia, encolar, nombre } from '../estado.ts'
import { reglasMision } from '../misiones2/registro.ts'
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

/** Texto de una opción de final con elección: «Rescatas a tu amigo: +5 de reputación». */
export function textoOpcionFinal(o: { texto: string; rep?: number; tesoro?: string; efecto?: string }): string {
  const partes = [o.rep ? `+${o.rep} de reputación` : '', o.tesoro ? `el Tesoro «${porId(o.tesoro).carta.nombre}»` : '', o.efecto ?? ''].filter(Boolean)
  return partes.length > 0 ? `${o.texto}: ${partes.join(', ')}` : o.texto
}

/** Final con elección: eliges una de las recompensas de la misión superada. */
export const elegirFinal: Manejador<'elegirFinal'> = (s, t, e) => {
  const entrada = porId(copia(s, t.mision).id)
  if (entrada.tipo !== 'capitulo') return 'hecha'
  const opciones = entrada.carta.recompensa.elige ?? []
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
  tareas.push(...(reglasMision(entrada.id)?.alElegir?.(s, o.clave) ?? []))
  encolar(s, ...tareas)
  return 'hecha'
}
