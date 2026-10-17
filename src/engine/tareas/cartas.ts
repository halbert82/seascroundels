// Primitivas con cartas: robar, perder un día, muelle, pagar, curar, reparar, perder Mejoras.

import { esIndestructible, nombreDe, tipoDe } from '../catalogo.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import type { Estado, InstId, TareaDe } from '../tipos.ts'
import { valor } from '../valores.ts'
import { arriba, barajar, mover, rebarajar } from '../zonas.ts'
import { DATOS } from '../datos.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'

/** Descarta la carta de arriba del mazo de Escenario sin aplicarla. */
export function perderUnDia(s: Estado): void {
  const carta = arriba(s, 'mazoEscenario')
  if (!carta) {
    anotar(s, 'aviso', 'Pierdes un día, pero ya no quedan cartas de Escenario.')
    return
  }
  mover(s, carta, 'descartesEscenario')
  s.infoRevelada++
  anotar(s, 'aviso', `Pierdes un día: se descarta «${nombre(s, carta)}» sin aplicarla.`)
}

/** Roba N cartas del mazo del capitán. Si se acaba, baraja sus descartes y pierdes un día. */
export function robarCartas(s: Estado, n: number): InstId[] {
  const robadas: InstId[] = []
  for (let i = 0; i < n; i++) {
    if (s.zonas.mazoCapitan.length === 0) {
      if (s.zonas.descartesCapitan.length === 0) {
        anotar(s, 'aviso', 'No quedan cartas que robar.')
        break
      }
      rebarajar(s, 'descartesCapitan', 'mazoCapitan')
      anotar(s, 'aviso', 'Se acaba el mazo del capitán: barajas su pila de descartes.')
      perderUnDia(s)
    }
    const carta = arriba(s, 'mazoCapitan')
    if (!carta) break
    mover(s, carta, 'mano', 'abajo')
    robadas.push(carta)
  }
  if (robadas.length > 0) {
    s.infoRevelada++
    anotar(s, 'robar', `Robas ${robadas.length}: ${nombres(s, robadas)}.`)
  }
  return robadas
}

/** Revela cartas del mazo de muelle al muelle. Si se acaba, se barajan sus descartes, sin penalización. */
export function revelarAlMuelle(s: Estado, n: number): void {
  const reveladas: InstId[] = []
  for (let i = 0; i < n; i++) {
    if (s.zonas.mazoMuelle.length === 0) {
      if (s.zonas.descartesMuelle.length === 0) break
      rebarajar(s, 'descartesMuelle', 'mazoMuelle')
      anotar(s, 'aviso', 'Se acaba el mazo de muelle: se baraja su pila de descartes.')
    }
    const carta = arriba(s, 'mazoMuelle')
    if (!carta) break
    mover(s, carta, 'muelle', 'abajo')
    reveladas.push(carta)
  }
  if (reveladas.length > 0) {
    s.infoRevelada++
    anotar(s, 'revelar', `Muelle: ${nombres(s, reveladas)}.`)
  }
}

export function tamanoMuelle(s: Estado): number {
  const puerto = DATOS.puertos.find((p) => p.id === s.puerto)
  if (!puerto) throw new Error(`Puerto desconocido: ${s.puerto}`)
  return puerto.muelle
}

export const robar: Manejador<'robar'> = (s, t) => {
  robarCartas(s, t.n)
  return 'hecha'
}

export const perderDia: Manejador<'perderDia'> = (s) => {
  perderUnDia(s)
  return 'hecha'
}

/** Al terminar el paso de Jugar cartas: se descarta el muelle entero y se repone. */
export const reponerMuelle: Manejador<'reponerMuelle'> = (s) => {
  const restos = [...s.zonas.muelle]
  for (const c of restos) mover(s, c, 'descartesMuelle')
  if (restos.length > 0) anotar(s, 'efecto', `Se descartan del muelle: ${nombres(s, restos)}.`)
  revelarAlMuelle(s, tamanoMuelle(s))
  return 'hecha'
}

export const revelarMuelle: Manejador<'revelarMuelle'> = (s, t) => {
  revelarAlMuelle(s, t.n)
  return 'hecha'
}

function cumpleFiltro(id: string, filtro: TareaDe<'buscarMuelle'>['filtro']): boolean {
  const tipo = tipoDe(id)
  if (filtro === 'tripulante') return tipo === 'tripulante'
  if (filtro === 'mejoraBarco') return tipo === 'mejoraBarco'
  return tipo === 'mejoraBarco' || tipo === 'mejoraTripulante'
}

const NOMBRE_FILTRO = { tripulante: 'un Tripulante', mejoraBarco: 'una Mejora de barco', mejora: 'una Mejora' } as const

/** Buscar: mira el mazo de muelle, pon la carta elegida en el muelle y baraja el mazo. */
export const buscarMuelle: Manejador<'buscarMuelle'> = (s, t, e) => {
  const candidatas = s.zonas.mazoMuelle.filter((c) => cumpleFiltro(copia(s, c).id, t.filtro))
  if (!e) {
    s.infoRevelada++ // Miras el mazo.
    if (candidatas.length === 0) {
      anotar(s, 'aviso', `Buscas ${NOMBRE_FILTRO[t.filtro]}, pero no queda ninguna en el mazo de muelle.`)
      barajar(s, 'mazoMuelle')
      return 'hecha'
    }
    return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'buscar' }, candidatas, min: 1, max: 1 })
  }
  const [elegida] = eleccionDe(e, 'cartas').ids
  if (!elegida) throw new Error('Falta la carta buscada')
  mover(s, elegida, 'muelle', 'abajo')
  barajar(s, 'mazoMuelle')
  anotar(s, 'efecto', `Buscas ${NOMBRE_FILTRO[t.filtro]}: «${nombre(s, elegida)}» pasa al muelle.`)
  return 'hecha'
}

/** Pagar un coste: descarta de la mano tantas cartas como indique. */
export const pagar: Manejador<'pagar'> = (s, t, e) => {
  if (t.cantidad <= 0) return 'hecha'
  if (!e) {
    if (s.zonas.mano.length < t.cantidad) throw new Error(`No hay cartas suficientes para pagar ${t.cantidad}`)
    return preguntar({
      tipo: 'elegirCartas',
      motivo: { clave: 'pagar', carta: t.motivo, n: t.cantidad },
      candidatas: [...s.zonas.mano],
      min: t.cantidad,
      max: t.cantidad,
    })
  }
  const ids = eleccionDe(e, 'cartas').ids
  for (const c of ids) mover(s, c, 'descartesCapitan')
  anotar(s, 'pagar', `Pagas ${ids.length} por «${nombreDe(t.motivo)}»: ${nombres(s, ids)}.`)
  return 'hecha'
}

export const reparar: Manejador<'reparar'> = (s, t) => {
  const antes = s.danoBarco
  s.danoBarco = Math.max(0, s.danoBarco - t.n)
  if (antes > 0) anotar(s, 'efecto', `Reparas ${antes - s.danoBarco}: el Barco queda con ${s.danoBarco} de daño.`)
  return 'hecha'
}

/** Curar N: «cadaUno» cura N a cada Tripulante; «repartir» reparte N como quiera el jugador. */
export const curar: Manejador<'curar'> = (s, t, e) => {
  const heridos = s.zonas.tripulacion.filter((c) => copia(s, c).heridas > 0)
  if (t.modo === 'cadaUno') {
    for (const c of heridos) copia(s, c).heridas = Math.max(0, copia(s, c).heridas - t.n)
    if (heridos.length > 0) anotar(s, 'efecto', `Curas ${t.n} a cada Tripulante.`)
    return 'hecha'
  }
  const total = heridos.reduce((n, c) => n + copia(s, c).heridas, 0)
  if (total === 0) return 'hecha'
  if (total <= t.n) {
    for (const c of heridos) copia(s, c).heridas = 0
    anotar(s, 'efecto', `Curas todas las heridas (${total}).`)
    return 'hecha'
  }
  if (!e) {
    const maximos: Partial<Record<InstId, number>> = {}
    for (const c of heridos) maximos[c] = copia(s, c).heridas
    return preguntar({ tipo: 'repartir', motivo: { clave: 'curar', n: t.n }, cantidad: t.n, maximos })
  }
  const reparto = eleccionDe(e, 'reparto').n
  const partes: string[] = []
  for (const [inst, n] of Object.entries(reparto) as [InstId, number][]) {
    if (!n) continue
    copia(s, inst).heridas -= n
    partes.push(`${n} a ${nombre(s, inst)}`)
  }
  anotar(s, 'efecto', `Curas ${t.n}: ${partes.join(', ')}.`)
  return 'hecha'
}

/** Pierdes una Mejora: eliges una del Barco o de un Tripulante (ni Tesoros ni indestructibles). */
export const perderMejora: Manejador<'perderMejora'> = (s, _t, e) => {
  const candidatas = s.zonas.mejoras.filter((m) => !esIndestructible(copia(s, m).id))
  const perder = (m: InstId) => {
    mover(s, m, 'descartesMuelle')
    anotar(s, 'efecto', `Pierdes «${nombre(s, m)}».`)
  }
  if (candidatas.length === 0) {
    anotar(s, 'efecto', 'No tienes ninguna Mejora que se pueda perder.')
    return 'hecha'
  }
  if (candidatas.length === 1 && candidatas[0]) {
    perder(candidatas[0])
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'perderMejora' }, candidatas, min: 1, max: 1 })
  const [m] = eleccionDe(e, 'cartas').ids
  if (m) perder(m)
  return 'hecha'
}

export const anadirTemporal: Manejador<'anadirTemporal'> = (s, t) => {
  s.temporales.push(t.temporal)
  return 'hecha'
}

/** Robar hasta el Mando al final del turno (con «−1 Mando» y «Escasez de pertrechos»). */
export const robarHastaMando: Manejador<'robarHastaMando'> = (s) => {
  const objetivo = valor(s, { tipo: 'objetivoRobo' })
  const n = objetivo - s.zonas.mano.length
  if (n > 0) encolar(s, { tipo: 'robar', n })
  return 'hecha'
}
