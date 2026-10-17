// Capacidades de las cartas de Peligro que se quedan en juego, generadas desde sus reglas: las formas de
// quitarlas (Prueba, agotar a un Tripulante con un Rasgo, pagar cartas), sus modificadores, lo que hacen cada
// vez que ocurre algo y su contador de fichas.

import { nombreDe, porId } from '../catalogo.ts'
import { registrarReglasPeligro, type CapacidadDeCarta, type Disparo, type ReglasPeligro } from '../definiciones.ts'
import { encuentroDe, entornoActual } from '../peligros.ts'
import type { Capacidad, CartaId, Estado, Evento, InstId, NuevaTarea } from '../tipos.ts'
import { destinoVigente } from '../valores.ts'

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
      return ev.tipo === 'cartaResuelta' && ev.carta !== yo
    case 'finTurno':
      return ev.tipo === 'finTurno'
    case 'superarPrueba':
      return ev.tipo === 'superarPrueba'
    case 'fallarPrueba':
      return ev.tipo === 'fallarPrueba'
  }
}

/** Capacidades de una carta de Peligro con reglas de «se queda en juego». */
export function capacidadesDePeligro(id: CartaId, reglas: ReglasPeligro): Capacidad[] {
  const caps: Capacidad[] = []
  // El Destino: mientras se aplica en la Prueba en curso.
  for (const c of reglas.destino?.capacidades ?? []) {
    caps.push(envolver(id, 'destino', `${id}.destino`, c, (s, yo) => yo !== null && destinoVigente(s) === yo))
  }
  for (const [entorno, r] of Object.entries(reglas.encuentros ?? {})) {
    if (!r) continue
    const esteEntorno = (s: Estado) => (porId(id).tipo === 'mazoPropio' ? entorno === 'unico' : entornoActual(s) === entorno)
    // El «Texto» del encuentro: mientras se resuelve (también su Prueba).
    for (const c of r.capacidades ?? []) {
      caps.push(envolver(id, 'encuentro', `${id}.${entorno}.enc`, c, (s, yo) => yo !== null && s.zonas.encuentro.includes(yo) && esteEntorno(s)))
    }
    const q = r.queda
    if (!q) continue
    // Solo vale la del encuentro que se ha leído (el del Entorno de la misión, o el único de un mazo propio).
    const activa = (s: Estado, yo: InstId | null): yo is InstId => yo !== null && s.zonas.peligrosEnJuego.includes(yo) && esteEntorno(s)
    const base = `${id}.${entorno}`
    for (const c of q.capacidades ?? []) caps.push(envolver(id, 'peligroEnJuego', `${base}.cap`, c, activa))
    q.acciones?.forEach((a, i) => {
      const accion: Capacidad = {
        clave: `${base}.accion${i}`,
        carta: id,
        ventana: 'accion',
        desde: 'peligroEnJuego',
        requisito: (s, yo) => activa(s, yo) && (!a.requisito || a.requisito(s, yo)),
        efecto: (_s, yo) => (yo ? [{ tipo: 'aplicarEfectos', efectos: a.efectos, contexto: 'efecto', fuente: yo }] : []),
      }
      if (a.coste) accion.coste = a.coste
      caps.push(accion)
    })

    // Lo que pasa además al quitarla con una de sus formas (antes de que salga del juego).
    const alQuitar = q.alQuitar ?? []
    const quitarla = (yo: InstId): NuevaTarea[] => [
      ...(alQuitar.length > 0 ? [{ tipo: 'aplicarEfectos' as const, efectos: alQuitar, contexto: 'efecto' as const, fuente: yo }] : []),
      { tipo: 'descartarPeligroEnJuego', carta: yo },
    ]
    q.quitar.forEach((forma, i) => {
      const clave = `${base}.quitar${i}`
      switch (forma.tipo) {
        case 'prueba':
          // La Prueba de una Acción es una Prueba normal: se compromete, sale Destino y Sin oposición si no hay nadie.
          // No se puede hacer durante otra Prueba (P2).
          caps.push({
            clave,
            carta: id,
            ventana: 'accion',
            desde: 'peligroEnJuego',
            requisito: (s, yo) => activa(s, yo) && s.prueba === null,
            efecto: (s, yo) =>
              yo
                ? [
                    {
                      tipo: 'pruebaSuelta',
                      fuente: yo,
                      paso: 'empezar',
                      definicion: {
                        nombre: `Quitar «${nombreDe(id)}»`,
                        palabrasClave: encuentroDe(s, yo).palabrasClave,
                        opciones: forma.opciones,
                        exito: [...alQuitar, ...(forma.exito ?? []), { tipo: 'descartarEsta' }],
                        fallo: forma.fallo ?? [],
                      },
                    },
                  ]
                : [],
          })
          return
        case 'agotarRasgo':
          caps.push({
            clave,
            carta: id,
            ventana: 'accion',
            desde: 'peligroEnJuego',
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
            desde: 'peligroEnJuego',
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
        desde: 'peligroEnJuego',
        modifica: (ctx, yo, c) =>
          activa(ctx.s, yo) && (c.tipo === 'dificultad' || c.tipo === 'totalPrueba') && c.tipo === m.a && (!m.hab || c.hab === m.hab) ? m.n : 0,
      })
    })

    q.disparos?.forEach((d, i) => {
      caps.push({
        clave: `${base}.disparo${i}`,
        carta: id,
        ventana: 'obligada',
        desde: 'peligroEnJuego',
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
        desde: 'peligroEnJuego',
        disparo: (s, yo, ev, fase) => fase === 'despues' && activa(s, yo) && coincide(contador.cuando, ev, yo),
        efecto: (_s, yo) => (yo ? [{ tipo: 'contador', carta: yo, clave: `${base}.contador` }] : []),
      })
    }
  }
  return caps
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
