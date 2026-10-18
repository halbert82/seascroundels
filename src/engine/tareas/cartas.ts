// Primitivas con cartas: robar, perder un día, muelle, pagar, curar, reparar, perder Mejoras.

import { costeImpreso, esIndestructible, nombreDe, tipoDe } from '../catalogo.ts'
import { anotar, copia, encolar, nombre, nombres, sucesoDescartada } from '../estado.ts'
import { curable, curarTripulante, quitarEstadoBarco } from '../estados.ts'
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

/**
 * Al terminar el paso de Jugar cartas: se descarta el muelle entero y se repone. Una carta de Peligro que
 * ocupa el muelle se queda (ocupando su hueco) hasta que pagues para descartarla.
 */
// La carta de Peligro del muelle no se descarta al reponerlo: sigue ocupando un hueco hasta que pagas (P18).
export const reponerMuelle: Manejador<'reponerMuelle'> = (s) => {
  const peligros = s.zonas.muelle.filter((c) => s.peligrosEnMuelle?.[c] !== undefined)
  const restos = s.zonas.muelle.filter((c) => !peligros.includes(c))
  for (const c of restos) mover(s, c, 'descartesMuelle')
  if (restos.length > 0) anotar(s, 'efecto', `Se descartan del muelle: ${nombres(s, restos)}.`)
  revelarAlMuelle(s, tamanoMuelle(s) - peligros.length)
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
  // «Marineros sin barco»: este turno, reclutar esa carta cuesta 1 menos.
  if (t.marca) {
    s.temporales.push({ clave: t.marca.clave, fuente: t.marca.fuente, hasta: 'finTurno', inst: elegida })
    anotar(s, 'efecto', `Este turno, reclutar a «${nombre(s, elegida)}» cuesta 1 menos.`)
  }
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
  anotar(s, 'pagar', `Pagas ${ids.length} por «${nombreDe(t.motivo)}»: ${nombres(s, ids)}.`, { tipo: 'pago', n: ids.length })
  return 'hecha'
}

/** Reparar N. Con «Vía de agua», el primer punto quita la ficha en vez del daño. */
export const reparar: Manejador<'reparar'> = (s, t) => {
  let n = t.n
  if (n > 0 && quitarEstadoBarco(s, 'viaDeAgua')) {
    n--
    anotar(s, 'efecto', 'Tapas la Vía de agua.')
  }
  const antes = s.danoBarco
  s.danoBarco = Math.max(0, s.danoBarco - n)
  if (antes > s.danoBarco) anotar(s, 'efecto', `Reparas ${antes - s.danoBarco}: el Barco queda con ${s.danoBarco} de daño.`)
  return 'hecha'
}

/**
 * Curar N: «cadaUno» cura N a cada Tripulante; «repartir» reparte N como quiera el jugador; «uno», N a un Tripulante.
 * Curar quita primero las fichas de Envenenado y Sangrando (P13).
 */
export const curar: Manejador<'curar'> = (s, t, e) => {
  const heridos = s.zonas.tripulacion.filter((c) => curable(s, c) > 0)
  if (t.modo === 'uno') {
    const candidatos = t.objetivo ? heridos.filter((c) => c === t.objetivo) : heridos
    if (candidatos.length === 0) return 'hecha'
    if (candidatos.length > 1 && !e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'curarUno', n: t.n }, candidatas: candidatos, min: 1, max: 1 })
    const objetivo = candidatos.length === 1 ? candidatos[0] : e ? eleccionDe(e, 'cartas').ids[0] : undefined
    if (!objetivo) return 'hecha'
    const texto = curarTripulante(s, objetivo, t.n)
    if (texto) anotar(s, 'efecto', `Curas a ${texto}.`)
    return 'hecha'
  }
  if (t.modo === 'cadaUno') {
    const textos = heridos.map((c) => curarTripulante(s, c, t.n)).filter(Boolean)
    if (textos.length > 0) anotar(s, 'efecto', `Curas ${t.n} a cada Tripulante: ${textos.join('; ')}.`)
    return 'hecha'
  }
  const total = heridos.reduce((n, c) => n + curable(s, c), 0)
  if (total === 0) return 'hecha'
  if (total <= t.n) {
    const textos = heridos.map((c) => curarTripulante(s, c, curable(s, c))).filter(Boolean)
    anotar(s, 'efecto', `Curas todo (${total}): ${textos.join('; ')}.`)
    return 'hecha'
  }
  if (!e) {
    const maximos: Partial<Record<InstId, number>> = {}
    for (const c of heridos) maximos[c] = curable(s, c)
    return preguntar({ tipo: 'repartir', motivo: { clave: 'curar', n: t.n }, cantidad: t.n, maximos })
  }
  const reparto = eleccionDe(e, 'reparto').n
  const partes: string[] = []
  for (const [inst, n] of Object.entries(reparto) as [InstId, number][]) {
    if (!n) continue
    const texto = curarTripulante(s, inst, n)
    if (texto) partes.push(texto)
  }
  anotar(s, 'efecto', `Curas ${t.n}: ${partes.join('; ')}.`)
  return 'hecha'
}

/**
 * Pierdes una Mejora: eliges una del Barco o de un Tripulante (ni Tesoros ni indestructibles). `soloBarco`: de barco.
 * `mayorCoste`: la de mayor coste impreso; si empatan, eliges entre ellas («Impuestos del gobernador»).
 */
export const perderMejora: Manejador<'perderMejora'> = (s, t, e) => {
  const posibles = s.zonas.mejoras.filter((m) => {
    const v = copia(s, m).vinculadaA
    if (esIndestructible(copia(s, m).id)) return false
    if (t.soloBarco && v !== 'barco') return false
    // «Pierdes 1 Mejora de un Tripulante comprometido».
    return !t.portadores || (v !== null && v !== 'barco' && t.portadores.includes(v))
  })
  const maximo = Math.max(0, ...posibles.map((m) => costeImpreso(copia(s, m).id)))
  const candidatas = t.mayorCoste ? posibles.filter((m) => costeImpreso(copia(s, m).id) === maximo) : posibles
  const perder = (m: InstId) => {
    mover(s, m, 'descartesMuelle')
    anotar(s, 'efecto', `Pierdes «${nombre(s, m)}».`)
    encolar(s, sucesoDescartada(m))
  }
  if (candidatas.length === 0) {
    anotar(s, 'efecto', 'No tienes ninguna Mejora que se pueda perder.')
    return 'hecha'
  }
  if (candidatas.length === 1 && candidatas[0]) {
    perder(candidatas[0])
    return 'hecha'
  }
  if (!e) {
    const motivo = t.mayorCoste ? { clave: 'perderMejora', texto: `Empatan en coste (${maximo}): eliges cuál pierdes.` } : { clave: 'perderMejora' }
    return preguntar({ tipo: 'elegirCartas', motivo, candidatas, min: 1, max: 1 })
  }
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
