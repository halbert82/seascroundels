// Capacidades de las cartas de Peligro con reglas especiales (su Destino y el texto de sus encuentros) y de las
// permanentes (fase 11), generadas desde sus reglas: las formas de quitarlas (Prueba, agotar a un Tripulante con un
// Rasgo, pagar cartas), sus modificadores, lo que hacen cada vez que ocurre algo y su contador de fichas.

import { porId } from '../catalogo.ts'
import {
  registrarReglasPeligro,
  registrarReglasPermanente,
  type CapacidadDeCarta,
  type Disparo,
  type ReglasPeligro,
  type ReglasPermanente,
} from '../definiciones.ts'
import { entornoActual } from '../peligros.ts'
import type { Capacidad, CartaId, Estado, Evento, InstId, NuevaTarea } from '../tipos.ts'
import { destinosVigentes } from '../valores.ts'

/** Envuelve una capacidad escrita en las reglas para que solo funcione cuando toca (`activa`). */
function envolver(
  id: CartaId,
  desde: Capacidad['desde'],
  base: string,
  c: CapacidadDeCarta,
  activa: (s: Estado, yo: InstId | null) => boolean,
): Capacidad {
  const cap: Capacidad = { ...c, clave: `${base}.${c.clave}`, carta: id, desde }
  const { modifica, disparo, requisito } = c
  if (modifica) cap.modifica = (ctx, yo, q) => (activa(ctx.s, yo) ? modifica(ctx, yo, q) : 0)
  if (disparo) cap.disparo = (s, yo, ev, fase) => activa(s, yo) && disparo(s, yo, ev, fase)
  cap.requisito = (s, yo) => activa(s, yo) && (!requisito || requisito(s, yo))
  return cap
}
import { quitarCapacidadesDe, registrarCapacidades } from './index.ts'

function coincide(cuando: Disparo, ev: Evento, yo: InstId): boolean {
  switch (cuando) {
    case 'revelarPeligro':
      return ev.tipo === 'revelarPeligro' && ev.carta !== yo
    case 'cartaResuelta':
      // El final del encuentro que la puso en juego no le cuenta («al terminar cada encuentro siguiente»).
      return ev.tipo === 'cartaResuelta' && ev.carta !== yo && ev.permanente !== yo
    case 'finTurno':
      return ev.tipo === 'finTurno'
    case 'superarPrueba':
      return ev.tipo === 'superarPrueba'
    case 'fallarPrueba':
      return ev.tipo === 'fallarPrueba'
  }
}

/** Capacidades de una carta de Peligro con reglas especiales: las de su Destino y las del texto de sus encuentros. */
export function capacidadesDePeligro(id: CartaId, reglas: ReglasPeligro): Capacidad[] {
  const caps: Capacidad[] = []
  // El Destino: mientras se aplica en la Prueba en curso.
  for (const c of reglas.destino?.capacidades ?? []) {
    caps.push(envolver(id, 'destino', `${id}.destino`, c, (s, yo) => yo !== null && destinosVigentes(s).includes(yo)))
  }
  for (const [entorno, r] of Object.entries(reglas.encuentros ?? {})) {
    if (!r) continue
    const esteEntorno = (s: Estado) => (porId(id).tipo === 'mazoPropio' ? entorno === 'unico' : entornoActual(s) === entorno)
    // El «Texto» del encuentro: mientras se resuelve (también su Prueba).
    for (const c of r.capacidades ?? []) {
      caps.push(envolver(id, 'encuentro', `${id}.${entorno}.enc`, c, (s, yo) => yo !== null && s.zonas.encuentro.includes(yo) && esteEntorno(s)))
    }
  }
  return caps
}

/**
 * Capacidades de una permanente (fase 11), generadas desde sus reglas: las formas de quitarla (Destina, agotar a un
 * Tripulante con un Rasgo, pagar cartas), sus Acciones, modificadores, lo que hace cada vez que ocurre algo y su
 * contador de fichas. Solo funcionan mientras está en la zona de permanentes.
 */
export function capacidadesDePermanente(id: CartaId, q: ReglasPermanente): Capacidad[] {
  const caps: Capacidad[] = []
  const activa = (s: Estado, yo: InstId | null): yo is InstId => yo !== null && s.zonas.permanentes.includes(yo)
  const base = id
  for (const c of q.capacidades ?? []) caps.push(envolver(id, 'permanente', `${base}.cap`, c, activa))
  q.acciones?.forEach((a, i) => {
    const accion: Capacidad = {
      clave: `${base}.accion${i}`,
      carta: id,
      ventana: 'accion',
      desde: 'permanente',
      requisito: (s, yo) => activa(s, yo) && (!a.requisito || a.requisito(s, yo)),
      efecto: (_s, yo) => (yo ? [{ tipo: 'aplicarEfectos', efectos: a.efectos, contexto: 'efecto', fuente: yo }] : []),
    }
    if (a.coste) accion.coste = a.coste
    caps.push(accion)
  })

  // Lo que pasa además al quitarla con una de sus formas (antes de que vuelva al mazo de historia).
  const alQuitar = q.alQuitar ?? []
  const quitarla = (yo: InstId): NuevaTarea[] => [
    ...(alQuitar.length > 0 ? [{ tipo: 'aplicarEfectos' as const, efectos: alQuitar, contexto: 'efecto' as const, fuente: yo }] : []),
    { tipo: 'devolverPermanente', carta: yo },
  ]
  q.quitar.forEach((forma, i) => {
    const clave = `${base}.quitar${i}`
    switch (forma.tipo) {
      case 'destina': {
        // Solo los encuentros piden Pruebas (Albert): «Destina X [habilidad]» es un coste, no una Prueba. Se puede pagar
        // en cualquier ventana de acción, también durante una Prueba.
        const { tipo: _tipo, efectos, ...destina } = forma
        caps.push({
          clave,
          carta: id,
          ventana: 'accion',
          desde: 'permanente',
          coste: [{ tipo: 'destina', ...destina }],
          requisito: activa,
          efecto: (_s, yo) => (yo ? [...(efectos && efectos.length > 0 ? [{ tipo: 'aplicarEfectos' as const, efectos, contexto: 'efecto' as const, fuente: yo }] : []), ...quitarla(yo)] : []),
        })
        return
      }
      case 'agotarRasgo':
        caps.push({
          clave,
          carta: id,
          ventana: 'accion',
          desde: 'permanente',
          coste: [{ tipo: 'agotarTripulante', rasgo: forma.rasgo }],
          requisito: activa,
          efecto: (_s, yo) => (yo ? quitarla(yo) : []),
        })
        return
      case 'pagar':
        caps.push({
          clave,
          carta: id,
          ventana: 'accion',
          desde: 'permanente',
          coste: [{ tipo: 'pagar', n: forma.n }],
          requisito: activa,
          efecto: (_s, yo) => (yo ? quitarla(yo) : []),
        })
        return
    }
  })

  q.modificadores?.forEach((m, i) => {
    caps.push({
      clave: `${base}.mod${i}`,
      carta: id,
      ventana: 'constante',
      desde: 'permanente',
      modifica: (ctx, yo, c) =>
        activa(ctx.s, yo) && (c.tipo === 'dificultad' || c.tipo === 'totalPrueba') && c.tipo === m.a && (!m.hab || c.hab === m.hab) ? m.n : 0,
    })
  })

  q.disparos?.forEach((d, i) => {
    caps.push({
      clave: `${base}.disparo${i}`,
      carta: id,
      ventana: 'obligada',
      desde: 'permanente',
      disparo: (s, yo, ev, fase) => fase === 'despues' && activa(s, yo) && coincide(d.cuando, ev, yo),
      efecto: (_s, yo) => (yo ? [{ tipo: 'aplicarEfectos', efectos: d.efectos, contexto: 'disparo', fuente: yo }] : []),
    })
  })

  const contador = q.contador
  if (contador) {
    caps.push({
      clave: `${base}.contador`,
      carta: id,
      ventana: 'obligada',
      desde: 'permanente',
      disparo: (s, yo, ev, fase) => fase === 'despues' && activa(s, yo) && coincide(contador.cuando, ev, yo),
      efecto: (_s, yo) => (yo ? [{ tipo: 'contador', carta: yo, clave: `${base}.contador` }] : []),
    })
  }
  return caps
}

/** Registra una permanente: sus reglas y las capacidades que salen de ellas. Se puede volver a llamar (sustituye). */
export function registrarPermanente(id: CartaId, reglas: ReglasPermanente): void {
  registrarReglasPermanente(id, reglas)
  quitarCapacidadesDe(id)
  registrarCapacidades(...capacidadesDePermanente(id, reglas))
}

/**
 * Registra una carta de Peligro con reglas especiales: sus reglas y las capacidades que salen de ellas.
 * Se puede volver a llamar con la misma carta (sustituye lo anterior).
 */
export function registrarPeligro(id: CartaId, reglas: ReglasPeligro): void {
  registrarReglasPeligro(id, reglas)
  quitarCapacidadesDe(id)
  registrarCapacidades(...capacidadesDePeligro(id, reglas))
}
